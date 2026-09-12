// PUT /api/trips/share { ts, shared } — toggle friends-visibility on one of
// my trips. Keyed by ts (the client's trip identity, unique per user).
// Private by default: sharing inserts a shared_trips row, unsharing deletes it.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const PUT: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const ts = body?.ts;
	const shared = body?.shared === true;
	if (typeof ts !== 'number' || !Number.isFinite(ts)) throw error(400, 'ts must be a number');
	const changed = await withUser(me.id, async (c) => {
		const own = await c.query(
			'SELECT id FROM trips WHERE user_id = current_user_id() AND ts = $1',
			[ts]
		);
		if (own.rows.length === 0) throw error(404, 'Trip not found');
		const tripId = own.rows[0].id as number;
		if (shared) {
			await c.query(
				`INSERT INTO shared_trips (trip_id, user_id) VALUES ($1, current_user_id())
				 ON CONFLICT (trip_id, user_id) DO NOTHING`,
				[tripId]
			);
		} else {
			await c.query(
				'DELETE FROM shared_trips WHERE trip_id = $1 AND user_id = current_user_id()',
				[tripId]
			);
		}
		return true;
	});
	void changed;
	return json({ ok: true, shared }, { headers: { 'Cache-Control': 'no-store' } });
};
