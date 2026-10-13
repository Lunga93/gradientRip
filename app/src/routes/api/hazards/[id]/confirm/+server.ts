// POST /api/hazards/[id]/confirm — confirm a hazard ("still there").
//
// Signed-in only. One confirm per rider: the hazard_confirmations PK
// (hazard_id, reporter) 409s repeats as 'Already confirmed' (reports copy:
// 'Already reported'). A fresh confirm bumps confirmations and renews expiry
// to LEAST(expires_at + 7d, created_at + 90d) (plan §5). The hazard read joins
// the parent route (hidden = false) — confirmations carry no independent RLS,
// so every hazard access goes through the route (migration header).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid hazard id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query(
			`SELECT h.id FROM hazards h JOIN public_routes r ON r.id = h.route_id
			 WHERE h.id = $1 AND r.hidden = false`,
			[id]
		);
		if (found.rows.length === 0) throw error(404, 'Hazard not found');
		try {
			await c.query(
				'INSERT INTO hazard_confirmations (hazard_id, reporter) VALUES ($1, current_user_id())',
				[id]
			);
		} catch (e: unknown) {
			// PRIMARY KEY (hazard_id, reporter) — this rider already confirmed.
			if (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505') {
				throw error(409, 'Already confirmed');
			}
			throw e;
		}
		const { rows } = await c.query(
			`UPDATE hazards SET confirmations = confirmations + 1,
				expires_at = LEAST(expires_at + interval '7 days', created_at + interval '90 days')
			 WHERE id = $1 RETURNING confirmations, expires_at`,
			[id]
		);
		return {
			confirmations: Number(rows[0].confirmations) || 0,
			expires_at: (rows[0].expires_at as Date).toISOString()
		};
	});
	return json({ id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
