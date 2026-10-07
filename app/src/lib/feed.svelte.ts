// Feed Phase 1 client state — RSVP + kudos + saves + reports cards.
// Plain fetch + Svelte 5 runes, mirroring ChannelsState in channels.svelte.ts.
// Offline-first: kudos given while offline land in the pure feed-queue.ts
// buffer (unit-tested); refreshes are debounced scheduleBackup-style and the
// last good list is cached so the feed renders from snapshot when offline.
import { queueKudos, flushQueue } from './feed-queue.js';

export interface FeedItem {
	kind: 'activity' | 'route' | 'event' | 'post';
	id: string;
	title: string;
	kudos: number;
	// Post-only fields (absent on route/event entries; Task 6 PostCard reads them).
	excerpt?: string | null;
	author_name?: string | null;
	author_avatar?: string | null;
	created_at?: string;
	status?: string | null;
	visibility?: string | null;
	media?: { kind: string; url: string }[];
}

// Phase 2 gate — the comments UI shipped with Task 6 (post cards, detail
// thread, reports), so the flag is on. The /api/comments and
// /api/notifications endpoints are live regardless of this flag.
export const feedPhase2 = true;

export interface FeedComment {
	id: string;
	parent_id: string | null;
	body: string;
	user_id: string;
	display_name: string | null;
	avatar_url: string | null;
	created_at: string;
}

export interface FeedNotification {
	id: string;
	kind: string;
	actor_id: string | null;
	feed_kind: string;
	target_id: string;
	comment_id: string | null;
	read_at: string | null;
	created_at: string;
	actor_name: string | null;
	actor_avatar: string | null;
}

const CACHE_KEY = 'gradient-feed-v1';
const FEED_KINDS = ['activity', 'route', 'event', 'post'] as const;

// Debounced refresh — mutations call scheduleFeedRefresh with no args; only
// the most recent refresh within the window fires (cf. scheduleBackup).
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const loadCache = (): FeedItem[] => {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(v): v is FeedItem =>
				!!v &&
				typeof v === 'object' &&
				(FEED_KINDS as readonly string[]).includes((v as FeedItem).kind) &&
				typeof (v as FeedItem).id === 'string' &&
				typeof (v as FeedItem).title === 'string' &&
				typeof (v as FeedItem).kudos === 'number' &&
				Number.isFinite((v as FeedItem).kudos)
		);
	} catch {
		return [];
	}
};

const saveCache = (items: FeedItem[]): void => {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify(items));
	} catch {
		/* quota — feed still works in memory */
	}
};

class FeedState {
	items = $state<FeedItem[]>(typeof localStorage !== 'undefined' ? loadCache() : []);
	loading = $state(false);
	lastError = $state('');
	// Phase 2 state — only populated while feedPhase2 is on.
	comments = $state<Record<string, FeedComment[]>>({});
	notifications = $state<FeedNotification[]>([]);
	unread = $state(0);

	readonly count = $derived(this.items.length);

	itemFor(id: string): FeedItem | undefined {
		return this.items.find((i) => i.id === id);
	}

	scheduleFeedRefresh(): void {
		if (typeof window === 'undefined') return;
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {
			refreshTimer = null;
			void this.load();
		}, 2500);
	}

	async load(): Promise<void> {
		this.loading = true;
		try {
			const resp = await fetch('/api/feed');
			if (!resp.ok) return;
			const data = (await resp.json()) as { items: FeedItem[] };
			if (!Array.isArray(data.items)) return;
			this.items = data.items;
			saveCache($state.snapshot(this.items));
			// Best-effort: flush any kudos queued while offline now that the
			// network works again.
			void this.flushKudos();
		} catch {
			/* offline — keep cached snapshot */
		} finally {
			this.loading = false;
		}
	}

	async giveKudos(routeId: string): Promise<void> {
		const item = this.itemFor(routeId);
		if (item) item.kudos += 1;
		this.scheduleFeedRefresh();
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			queueKudos(routeId);
			return;
		}
		try {
			const resp = await fetch(`/api/routes/${encodeURIComponent(routeId)}/kudos`, {
				method: 'POST'
			});
			if (!resp.ok) {
				// Revert the optimistic +1; only retryable failures re-queue.
				if (item) item.kudos -= 1;
				if (resp.status >= 500) queueKudos(routeId);
				return;
			}
			const data = (await resp.json().catch(() => ({}))) as {
				kudosed?: boolean;
				kudos?: number;
			};
			if (item) {
				// Authoritative server count reconciles the optimistic +1 —
				// on re-kudos (kudosed:false) this reverts it.
				if (typeof data.kudos === 'number' && Number.isFinite(data.kudos)) {
					item.kudos = data.kudos;
				} else if (data.kudosed === false) {
					item.kudos -= 1;
				}
			}
		} catch {
			if (item) item.kudos -= 1;
			queueKudos(routeId);
		}
	}

	// Post kudos (Task 6) — same optimistic +1 / reconcile / rollback shape as
	// giveKudos, but against /api/posts/[id]/kudos and operating on the
	// caller's object (home entries, card props, detail rows) rather than
	// feed.items, so no parallel kudos cache is forked. The offline queue is
	// route-kudos shaped, so offline post kudos revert with honest copy
	// instead of queuing against the wrong endpoint.
	async givePostKudos(item: { id: string; kudos: number; kudosed?: boolean }): Promise<{
		ok: boolean;
		message: string;
	}> {
		item.kudos += 1;
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			item.kudos -= 1;
			return { ok: false, message: 'You appear to be offline' };
		}
		try {
			const resp = await fetch(`/api/posts/${encodeURIComponent(item.id)}/kudos`, {
				method: 'POST'
			});
			if (!resp.ok) {
				item.kudos -= 1;
				return { ok: false, message: 'Could not send kudos — try again.' };
			}
			const data = (await resp.json().catch(() => ({}))) as {
				kudosed?: boolean;
				kudos?: number;
			};
			// Authoritative server count reconciles the optimistic +1 —
			// on re-kudos (kudosed:false) this reverts it.
			if (typeof data.kudos === 'number' && Number.isFinite(data.kudos)) {
				item.kudos = data.kudos;
			} else if (data.kudosed === false) {
				item.kudos -= 1;
			}
			if (data.kudosed === true) item.kudosed = true;
			return { ok: true, message: '' };
		} catch {
			item.kudos -= 1;
			return { ok: false, message: 'Could not send kudos — try again.' };
		}
	}

	async flushKudos(): Promise<void> {
		const pending = flushQueue();
		for (let i = 0; i < pending.length; i++) {
			const routeId = pending[i];
			let resp: Response;
			try {
				resp = await fetch(`/api/routes/${encodeURIComponent(routeId)}/kudos`, { method: 'POST' });
			} catch {
				// Network down — re-queue current + untouched remainder, stop.
				pending.slice(i).forEach(queueKudos);
				break;
			}
			if (!resp.ok) {
				if (resp.status >= 500) {
					// Retryable — re-queue current + remainder, stop.
					pending.slice(i).forEach(queueKudos);
					break;
				}
				// 4xx — permanent, drop and continue with the rest.
			}
		}
		this.scheduleFeedRefresh();
	}

	async report(
		targetKind: string,
		targetId: string,
		reason: string
	): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch('/api/reports', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ target_kind: targetKind, target_id: targetId, reason })
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not send report';
				this.lastError = message;
				return { ok: false, message };
			}
			return { ok: true, message: 'Thanks — report received' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	// --- Phase 2 (comments gated behind feedPhase2; endpoints stay live) ---
	// Notifications UI lives on /activity (Task 7 owns it read-only), so
	// loadNotifications/markNotificationsRead stay ungated even while
	// feedPhase2 is false. Comments remain gated until Phase 1 is stable.

	commentsFor(targetId: string): FeedComment[] {
		return this.comments[targetId] ?? [];
	}

	async loadComments(kind: string, targetId: string): Promise<void> {
		if (!feedPhase2) return;
		try {
			const resp = await fetch(
				`/api/comments?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(targetId)}`
			);
			if (!resp.ok) return;
			const data = (await resp.json()) as { items: FeedComment[] };
			if (!Array.isArray(data.items)) return;
			this.comments = { ...this.comments, [targetId]: data.items };
		} catch {
			/* offline — keep last known */
		}
	}

	async postComment(
		kind: string,
		targetId: string,
		body: string,
		parentId: string | null = null
	): Promise<{ ok: boolean; message: string }> {
		if (!feedPhase2) return { ok: false, message: 'Comments are not enabled yet' };
		this.lastError = '';
		try {
			const resp = await fetch('/api/comments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kind, target_id: targetId, body, parent_id: parentId })
			});
			const data = (await resp.json().catch(() => ({}))) as { message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not post comment';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.loadComments(kind, targetId);
			return { ok: true, message: 'Comment posted' };
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	async loadNotifications(): Promise<void> {
		try {
			const resp = await fetch('/api/notifications');
			if (!resp.ok) return;
			const data = (await resp.json()) as { items: FeedNotification[]; unread: number };
			if (Array.isArray(data.items)) this.notifications = data.items;
			if (typeof data.unread === 'number') this.unread = data.unread;
		} catch {
			/* offline — keep last known badge */
		}
	}

	async markNotificationsRead(): Promise<void> {
		try {
			const resp = await fetch('/api/notifications', { method: 'POST' });
			if (!resp.ok) return;
			await this.loadNotifications();
		} catch {
			/* offline — badge keeps its count */
		}
	}
}

export const feed = new FeedState();
