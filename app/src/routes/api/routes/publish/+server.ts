import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { geomHash } from '$lib/community/geom.js';
import { parseSports } from '$lib/profiles/profile.js';

const isValidPoint = (p: unknown): p is [number, number] =>
	Array.isArray(p) &&
	p.length === 2 &&
	typeof p[0] === 'number' &&
	typeof p[1] === 'number' &&
	Number.isFinite(p[0]) &&
	Number.isFinite(p[1]) &&
	p[0] >= -90 &&
	p[0] <= 90 &&
	p[1] >= -180 &&
	p[1] <= 180;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const sport = typeof body?.sport === 'string' ? body.sport : '';
	const line = Array.isArray(body?.line) ? body.line : null;
	if (!title || title.length > 80 || !line || line.length < 2) throw error(400, 'title and line required');
	if (parseSports([sport]).length === 0) throw error(400, 'unknown sport');
	if (!line.every(isValidPoint)) throw error(400, 'line must be [lat, lon] pairs in range');
	const hash = geomHash(line, sport);
	const { rows } = await withUser(me.id, async (c) => {
		return c.query(
			`INSERT INTO public_routes (author, title, sport, line, geom_hash) VALUES (current_user_id(), $1, $2, $3::jsonb, $4)
			 ON CONFLICT (geom_hash, sport) DO NOTHING RETURNING id`,
			[title, sport, JSON.stringify(line), hash]
		);
	});
	// NOTE (Task 3 ledger): a deduped publish returns NO id — `id` is
	// optional downstream; callers must handle `{ deduped: true }` without one.
	if (rows.length === 0) return json({ deduped: true }, { headers: { 'Cache-Control': 'no-store' } });
	const newId = rows[0].id as string;
	await withUser(me.id, async (c) => {
		await c.query('INSERT INTO route_stats (route_id) VALUES ($1) ON CONFLICT (route_id) DO NOTHING', [
			newId
		]);
	});
	return json({ id: newId, deduped: false }, { headers: { 'Cache-Control': 'no-store' } });
};
