// Feed Phase 1 client state — RSVP + kudos + saves + reports cards.
// Plain fetch + Svelte 5 runes, mirroring ChannelsState in channels.svelte.ts.
// Offline-first: kudos given while offline land in the pure feed-queue.ts
// buffer (unit-tested); refreshes are debounced scheduleBackup-style and the
// last good list is cached so the feed renders from snapshot when offline.
import { queueKudos, flushQueue } from './feed-queue.js';

export interface FeedItem {
	kind: 'activity' | 'route' | 'event';
	id: string;
	title: string;
	kudos: number;
}

const CACHE_KEY = 'gradient-feed-v1';
const FEED_KINDS = ['activity', 'route', 'event'] as const;

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
}

export const feed = new FeedState();
