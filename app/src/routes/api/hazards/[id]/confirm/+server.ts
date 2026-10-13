// POST /api/hazards/[id]/confirm — confirm a hazard ("still there").
//
// Signed-in only. One confirm per rider: the hazard_confirmations PK
// (hazard_id, reporter) 409s repeats as 'Already confirmed' (reports copy:
// 'Already reported'). A fresh confirm bumps confirmations and renews expiry
// from now: LEAST(GREATEST(expires_at, now()) + 7d, created_at + 90d), with capped:true when the 90d cap clamps the renewal.
// The hazard read joins the parent route (hidden = false) — confirmations carry no independent RLS,
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
		// Renewal extends from now (expired hazards resurrect): the 90d cap
		// clamps the +7d bump, and capped reports exactly that (same snapshot).
		const { rows } = await c.query(
			`WITH prev AS (SELECT expires_at AS e, created_at AS c FROM hazards WHERE id = $1)
			 UPDATE hazards SET confirmations = confirmations + 1,
				expires_at = (SELECT LEAST(GREATEST(p.e, now()) + interval '7 days', p.c + interval '90 days') FROM prev p)
			 WHERE id = $1
			 RETURNING confirmations, expires_at,
				((SELECT GREATEST(p.e, now()) + interval '7 days' FROM prev p)
				 > (SELECT p.c + interval '90 days' FROM prev p)) AS capped`,
			[id]
		);
		return {
			confirmations: Number(rows[0].confirmations) || 0,
			expires_at: (rows[0].expires_at as Date).toISOString(),
			capped: rows[0].capped as boolean
		};
	});
	return json({ id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
