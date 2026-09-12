// Live-position helpers: freshness classification (pure, unit-tested) and
// the friend-visibility query shared by the friends list and the SSE feed.
//
// Privacy rule: a position is only ever returned for accepted friends, and
// only when the fix is recent — riders older than LIVE_STALE_MS vanish.

export const LIVE_FRESH_MS = 2 * 60 * 1000;
export const LIVE_STALE_MS = 10 * 60 * 1000;

export type Freshness = 'live' | 'stale' | null;

export const classifyFreshness = (liveAt: string | null, now = Date.now()): Freshness => {
	if (!liveAt) return null;
	const age = now - new Date(liveAt).getTime();
	if (!Number.isFinite(age) || age < 0) return null;
	if (age <= LIVE_FRESH_MS) return 'live';
	if (age <= LIVE_STALE_MS) return 'stale';
	return null;
};
