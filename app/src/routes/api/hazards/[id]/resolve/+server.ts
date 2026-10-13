// POST /api/hazards/[id]/resolve — retire a hazard.
//
// Reporter or route author only (else 403). There is no resolved column by
// design: resolve sets expires_at = now(), so the hazard vanishes from every
// open-hazards read immediately (detail/explore filter expires_at > now()).
// The hazard read joins the parent route — child tables carry no independent
// RLS, so every hazard access goes through the route (migration header).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid hazard id');
	await withUser(me.id, async (c) => {
		const found = await c.query(
			`SELECT h.id, h.reporter, r.author AS route_author FROM hazards h
			 JOIN public_routes r ON r.id = h.route_id WHERE h.id = $1`,
			[id]
		);
		if (found.rows.length === 0) throw error(404, 'Hazard not found');
		const row = found.rows[0];
		if ((row.reporter as string) !== me.id && (row.route_author as string) !== me.id) {
			throw error(403, 'Only the reporter or the route author can resolve this hazard');
		}
		await c.query('UPDATE hazards SET expires_at = now() WHERE id = $1', [id]);
	});
	return json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
};
