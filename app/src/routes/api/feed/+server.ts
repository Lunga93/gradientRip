// GET /api/feed — Feed Phase 1 list combining public routes (with kudos
// from route_stats, cf. explore endpoint) and upcoming events the caller can
// see (open + member-private channels, cf. events RSVP). Shape
// { kind: 'activity'|'route'|'event'; id; title; kudos } is consumed by
// Task 9 comments. No 'activity' rows exist in v1 — the kind stays in the
// union as forward-compat.
import { json, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export interface FeedEntry {
	kind: 'activity' | 'route' | 'event';
	id: string;
	title: string;
	kudos: number;
}

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const items = await withUser(me.id, async (c) => {
		const routes = await c.query(
			`SELECT r.id, r.title, COALESCE(s.kudos, 0)::int AS kudos
			 FROM public_routes r LEFT JOIN route_stats s ON s.route_id = r.id
			 WHERE r.hidden = false
			 ORDER BY r.created_at DESC LIMIT 50`
		);
		const events = await c.query(
			`SELECT e.id, e.title FROM events e JOIN channels ch ON ch.id = e.channel_id
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
				kudos: Number(r.kudos) || 0
			})),
			...events.rows.map((e) => ({
				kind: 'event' as const,
				id: e.id as string,
				title: e.title as string,
				kudos: 0
			}))
		];
		return out;
	});
	return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};
