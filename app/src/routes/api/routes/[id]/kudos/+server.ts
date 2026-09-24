// POST /api/routes/[id]/kudos — idempotent kudos (one per user).
// INSERT ... ON CONFLICT DO NOTHING; route_stats.kudos is bumped by the
// trg_route_kudos_bump trigger (migration-owned route_kudos table), so no
// direct UPDATE here — that would double-count (cf. save handler).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid route id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id FROM public_routes WHERE id = $1 AND hidden = false', [id]);
		if (found.rows.length === 0) throw error(404, 'Route not found');
		const ins = await c.query(
			'INSERT INTO route_kudos (route_id, user_id) VALUES ($1, current_user_id()) ON CONFLICT DO NOTHING',
			[id]
		);
		const { rows } = await c.query('SELECT kudos FROM route_stats WHERE route_id = $1', [id]);
		return { kudosed: (ins.rowCount ?? 0) > 0, kudos: (rows[0]?.kudos as number) ?? 0 };
	});
	return json({ id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
