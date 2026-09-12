// Social client state — auth probe, friends, requests, shared trips, and the
// live SSE subscription. Plain fetch + Svelte 5 runes; everything degrades
// to the anonymous offline experience when signed out or offline.
import type { Trip } from './storage.js';
import { rowToTrip } from './sync.js';
import { subscribeLive, type LivePeer } from './live.js';

export interface AuthMe {
	id: string;
	email: string | null;
	display_name: string | null;
	avatar_url: string | null;
	google_id: string | null;
}

export interface FriendEntry {
	id: string;
	display_name: string | null;
	avatar_url: string | null;
	email: string | null;
	lat: number | null;
	lon: number | null;
	speed: number | null;
	live_at: string | null;
}

export interface PendingEntry {
	id: string;
	display_name: string | null;
	avatar_url: string | null;
	created_at: string;
}

const displayName = (name: string | null, email: string | null, fallback: string): string =>
	name?.trim() ? name : email?.split('@')[0] || fallback;

export const friendName = (f: FriendEntry | PendingEntry | LivePeer): string =>
	displayName(f.display_name, 'email' in f ? f.email : null, 'Rider');

class SocialState {
	// undefined = not probed yet, null = signed out
	me = $state<AuthMe | null | undefined>(undefined);
	friends = $state<FriendEntry[]>([]);
	incoming = $state<PendingEntry[]>([]);
	outgoing = $state<PendingEntry[]>([]);
	livePeers = $state<LivePeer[]>([]);
	liveConnected = $state(false);
	friendTrips = $state<Record<string, Trip[]>>({});
	expandedFriend = $state<string | null>(null);
	lastError = $state('');

	// --- derived ---
	readonly signedIn = $derived(this.me !== undefined && this.me !== null);
	readonly liveNow = $derived(this.livePeers.filter((p) => p.freshness === 'live'));
	readonly incomingCount = $derived(this.incoming.length);

	livePeerFor(id: string): LivePeer | undefined {
		return this.livePeers.find((p) => p.id === id);
	}

	async probeMe(): Promise<void> {
		try {
			const resp = await fetch('/api/auth/me');
			if (!resp.ok) {
				this.me = null;
				return;
			}
			const data = (await resp.json()) as { user: AuthMe | null };
			this.me = data.user;
			if (data.user) await this.loadFriends();
		} catch {
			this.me = null;
		}
	}

	async logout(): Promise<void> {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
		} catch {
			/* session already gone server-side */
		}
		this.stopLive();
		this.me = null;
		this.friends = [];
		this.incoming = [];
		this.outgoing = [];
		this.friendTrips = {};
		this.expandedFriend = null;
	}

	async loadFriends(): Promise<void> {
		if (!this.signedIn) return;
		try {
			const resp = await fetch('/api/friends');
			if (resp.status === 401) {
				this.me = null;
				return;
			}
			if (!resp.ok) return;
			const data = (await resp.json()) as {
				friends: FriendEntry[];
				incoming: PendingEntry[];
				outgoing: PendingEntry[];
			};
			this.friends = data.friends;
			this.incoming = data.incoming;
			this.outgoing = data.outgoing;
		} catch {
			/* offline — keep last known list */
		}
	}

	async sendRequest(email: string): Promise<{ ok: boolean; message: string }> {
		this.lastError = '';
		try {
			const resp = await fetch('/api/friends', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});
			const data = (await resp.json().catch(() => ({}))) as { status?: string; message?: string };
			if (!resp.ok) {
				const message = typeof data.message === 'string' ? data.message : 'Could not send the request';
				this.lastError = message;
				return { ok: false, message };
			}
			await this.loadFriends();
			return {
				ok: true,
				message: data.status === 'accepted' ? 'You are now riding buddies' : 'Request sent'
			};
		} catch {
			const message = 'You appear to be offline';
			this.lastError = message;
			return { ok: false, message };
		}
	}

	async respond(userId: string, accept: boolean): Promise<void> {
		try {
			const resp = await fetch('/api/friends/respond', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, accept })
			});
			if (resp.ok) await this.loadFriends();
		} catch {
			/* offline — retry later */
		}
	}

	async removeFriend(userId: string): Promise<void> {
		try {
			const resp = await fetch(`/api/friends/${encodeURIComponent(userId)}`, { method: 'DELETE' });
			if (resp.ok) {
				await this.loadFriends();
				if (this.expandedFriend === userId) this.expandedFriend = null;
			}
		} catch {
			/* offline — retry later */
		}
	}

	async toggleShare(ts: number, shared: boolean): Promise<boolean> {
		try {
			const resp = await fetch('/api/trips/share', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ts, shared })
			});
			return resp.ok;
		} catch {
			return false;
		}
	}

	async loadFriendTrips(userId: string): Promise<void> {
		try {
			const resp = await fetch(`/api/friends/${encodeURIComponent(userId)}/trips`);
			if (!resp.ok) return;
			const rows = (await resp.json()) as Parameters<typeof rowToTrip>[0][];
			this.friendTrips = { ...this.friendTrips, [userId]: rows.map(rowToTrip) };
		} catch {
			/* offline — keep last known */
		}
	}

	toggleExpand(userId: string): void {
		if (this.expandedFriend === userId) {
			this.expandedFriend = null;
			return;
		}
		this.expandedFriend = userId;
		if (!this.friendTrips[userId]) void this.loadFriendTrips(userId);
	}

	startLive(): void {
		if (typeof window === 'undefined' || !this.signedIn) return;
		this.stopLive();
		this.unsubscribe = subscribeLive((snap) => {
			this.liveConnected = true;
			this.livePeers = snap.friends;
			if (typeof snap.incoming === 'number' && snap.incoming !== this.incoming.length) {
				void this.loadFriends();
			}
		});
	}

	stopLive(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.liveConnected = false;
		this.livePeers = [];
	}

	private unsubscribe: (() => void) | null = null;
}

export const social = new SocialState();
