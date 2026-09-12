// Live social transport — position publishing (throttled PUT while riding or
// recording) and the friends SSE subscription. Best-effort throughout: the
// app stays fully offline-capable and social features silently degrade.

export interface LiveFix {
	lat: number;
	lon: number;
	speed: number | null;
	heading: number | null;
	accuracy: number | null;
}

export interface LivePeer {
	id: string;
	display_name: string | null;
	avatar_url: string | null;
	lat: number;
	lon: number;
	speed: number | null;
	live_at: string;
	freshness: 'live' | 'stale';
}

export interface LiveSnapshot {
	type: string;
	ts: number;
	friends: LivePeer[];
	incoming: number;
}

export const PUBLISH_MS = 5000;

// Pure throttle decision (unit-tested): publish when the window elapsed.
export const shouldPublish = (lastPublish: number, now: number, windowMs = PUBLISH_MS): boolean =>
	now - lastPublish >= windowMs;

let lastPublish = 0;

export const resetPublishThrottle = (): void => {
	lastPublish = 0;
};

export const publishPosition = async (fix: LiveFix): Promise<boolean> => {
	if (typeof window === 'undefined') return false;
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
	const now = Date.now();
	if (!shouldPublish(lastPublish, now)) return false;
	lastPublish = now;
	try {
		const resp = await fetch('/api/live/position', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(fix)
		});
		return resp.ok;
	} catch {
		return false;
	}
};

export const stopPublishing = async (): Promise<void> => {
	lastPublish = 0;
	if (typeof window === 'undefined') return;
	try {
		await fetch('/api/live/position', { method: 'DELETE' });
	} catch {
		/* offline — the row expires server-side via the stale window */
	}
};

// Subscribe to the friends SSE feed. Returns an unsubscribe function.
// EventSource sends same-origin cookies, so no token handling is needed.
export const subscribeLive = (onSnapshot: (snap: LiveSnapshot) => void): (() => void) => {
	if (typeof window === 'undefined' || typeof EventSource === 'undefined') return () => {};
	let source: EventSource | null = null;
	try {
		source = new EventSource('/api/live/friends');
	} catch {
		return () => {};
	}
	source.onmessage = (e: MessageEvent): void => {
		try {
			const snap = JSON.parse(e.data as string) as LiveSnapshot;
			if (snap && snap.type === 'friends' && Array.isArray(snap.friends)) onSnapshot(snap);
			else if (snap && snap.type === 'hello') onSnapshot({ ...snap, friends: [], incoming: 0 });
		} catch {
			/* malformed frame — next poll recovers */
		}
	};
	return () => {
		try {
			source?.close();
		} catch {
			/* already closed */
		}
		source = null;
	};
};
