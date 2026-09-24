// POST /api/routes/[id]/save — idempotent save (bookmark) of a public route.
// INSERT ... ON CONFLICT DO NOTHING; route_stats.saves is bumped directly
// here ONLY when the insert adds a row. TODO(Task 5/6): move the saves store
// to a migration-owned table + trigger bump and drop the direct UPDATE to
// avoid double-counting once that trigger exists. No RLS/trigger changes here.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid route id');
	const data = await withUser(me.id, async (c) => {
		await c.query(`CREATE TABLE IF NOT EXISTS route_saves (
			route_id UUID NOT NULL REFERENCES public_routes(id) ON DELETE CASCADE,
			user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			PRIMARY KEY (route_id, user_id)
		)`);
		const found = await c.query('SELECT id FROM public_routes WHERE id = $1 AND hidden = false', [id]);
		if (found.rows.length === 0) throw error(404, 'Route not found');
		const ins = await c.query(
			'INSERT INTO route_saves (route_id, user_id) VALUES ($1, current_user_id()) ON CONFLICT DO NOTHING',
			[id]
		);
		if ((ins.rowCount ?? 0) > 0) {
			await c.query(
				`INSERT INTO route_stats (route_id, saves) VALUES ($1, 1)
				 ON CONFLICT (route_id) DO UPDATE SET saves = route_stats.saves + 1`,
				[id]
			);
		}
		const { rows } = await c.query('SELECT saves FROM route_stats WHERE route_id = $1', [id]);
		return { saved: (ins.rowCount ?? 0) > 0, saves: (rows[0]?.saves as number) ?? 0 };
	});
	return json({ id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
