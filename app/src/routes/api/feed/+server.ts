// GET /api/feed — Feed Phase 1 list combining public routes (with kudos
// from route_stats, cf. explore endpoint) and upcoming events the caller can
// see (open + member-private channels, cf. events RSVP). Shape
// { kind: 'activity'|'route'|'event'; id; title; kudos } is consumed by
// Task 9 comments. No 'activity' rows exist in v1 — the kind stays in the
// union as forward-compat.
//
// Task 9 enrichment (all additive, core shape untouched): routes carry
// sport/saves/rides + a server-computed `fit` badge (same thresholds as
// fitBadge(), cf. explore endpoint) and author name/avatar for the card
// header; events carry start_at/going_count + channel name and creator
// name/avatar. created_at backs relTime on both kinds.
import { json, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { fitBadge } from '$lib/community/scoring.js';

export interface FeedEntry {
	kind: 'activity' | 'route' | 'event';
	id: string;
	title: string;
	kudos: number;
	created_at: string;
	sport: string | null;
	saves: number;
	rides: number;
	fit: 'fly' | 'ok' | 'caution' | 'stop' | null;
	start_at: string | null;
	going_count: number;
	channel: string | null;
	author_name: string | null;
	author_avatar: string | null;
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const fitOf = (stats: unknown): FeedEntry['fit'] => {
	if (!stats || typeof stats !== 'object') return null;
	const st = stats as Record<string, unknown>;
	const vals = ['totalWh', 'usableWh', 'worstClimb', 'climbLimit', 'worstDescent', 'brakeLimit'].map(
		(k) => st[k]
	);
	if (!vals.every(isFiniteNum)) return null;
	const [totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit] = vals as number[];
	return fitBadge(totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit);
};

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const items = await withUser(me.id, async (c) => {
		const routes = await c.query(
			`SELECT r.id, r.title, r.sport, r.stats, r.created_at,
				COALESCE(s.rides, 0)::int AS rides,
				COALESCE(s.saves, 0)::int AS saves,
				COALESCE(s.kudos, 0)::int AS kudos,
				u.display_name AS author_name, u.avatar_url AS author_avatar
			 FROM public_routes r LEFT JOIN route_stats s ON s.route_id = r.id
			 LEFT JOIN users u ON u.id = r.author
			 WHERE r.hidden = false
			 ORDER BY r.created_at DESC LIMIT 50`
		);
		const events = await c.query(
			`SELECT e.id, e.title, e.start_at, e.created_at, ch.name AS channel,
				(SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count,
				u.display_name AS author_name, u.avatar_url AS author_avatar
			 FROM events e JOIN channels ch ON ch.id = e.channel_id
			 LEFT JOIN users u ON u.id = e.created_by
			 WHERE e.start_at >= now() - interval '1 day'
			 AND (ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))
			 ORDER BY e.start_at ASC LIMIT 50`
		);
		const out: FeedEntry[] = [
			...routes.rows.map((r) => ({
				kind: 'route' as const,
				id: r.id as string,
				title: r.title as string,
				kudos: Number(r.kudos) || 0,
				created_at: (r.created_at as Date).toISOString(),
				sport: (r.sport as string | null) ?? null,
				saves: Number(r.saves) || 0,
				rides: Number(r.rides) || 0,
				fit: fitOf(r.stats),
				start_at: null,
				going_count: 0,
				channel: null,
				author_name: (r.author_name as string | null) ?? null,
				author_avatar: (r.author_avatar as string | null) ?? null
			})),
			...events.rows.map((e) => ({
				kind: 'event' as const,
				id: e.id as string,
				title: e.title as string,
				kudos: 0,
				created_at: (e.created_at as Date).toISOString(),
				sport: null,
				saves: 0,
				rides: 0,
				fit: null,
				start_at: (e.start_at as Date).toISOString(),
				going_count: Number(e.going_count) || 0,
				channel: (e.channel as string | null) ?? null,
				author_name: (e.author_name as string | null) ?? null,
				author_avatar: (e.author_avatar as string | null) ?? null
			}))
		];
		return out;
	});
	return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};
