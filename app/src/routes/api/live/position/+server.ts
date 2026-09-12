// /api/live/position — publish (PUT) or clear (DELETE) my live GPS fix.
// Called every few seconds while riding/recording; friends read it via SSE.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const PUT: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const lat = body?.lat;
	const lon = body?.lon;
	if (!finite(lat) || lat < -90 || lat > 90) throw error(400, 'lat must be within -90..90');
	if (!finite(lon) || lon < -180 || lon > 180) throw error(400, 'lon must be within -180..180');
	const speed = finite(body?.speed) && body.speed >= 0 ? body.speed : null;
	const heading = finite(body?.heading) && body.heading >= 0 && body.heading < 360 ? body.heading : null;
	const accuracy = finite(body?.accuracy) && body.accuracy >= 0 ? body.accuracy : null;
	await withUser(me.id, async (c) => {
		await c.query(
			`INSERT INTO live_positions (user_id, lat, lon, speed, heading, accuracy)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5)
			 ON CONFLICT (user_id) DO UPDATE SET
			   lat = EXCLUDED.lat, lon = EXCLUDED.lon,
			   speed = EXCLUDED.speed, heading = EXCLUDED.heading,
			   accuracy = EXCLUDED.accuracy, updated_at = now()`,
			[lat, lon, speed, heading, accuracy]
		);
	});
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	await withUser(me.id, async (c) => {
		await c.query('DELETE FROM live_positions WHERE user_id = current_user_id()');
	});
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
