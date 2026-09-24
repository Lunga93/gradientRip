import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { geomHash } from '$lib/community/geom.js';

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const sport = typeof body?.sport === 'string' ? body.sport : '';
	const line = Array.isArray(body?.line) ? body.line : null;
	if (!title || title.length > 80 || !line || line.length < 2) throw error(400, 'title and line required');
	const hash = geomHash(line, sport);
	const { rows } = await withUser(me.id, async (c) => {
		return c.query(
			`INSERT INTO public_routes (author, title, sport, line, geom_hash) VALUES (current_user_id(), $1, $2, $3, $4)
			 ON CONFLICT (geom_hash, sport) DO NOTHING RETURNING id`,
			[title, sport, JSON.stringify(line), hash]
		);
	});
	if (rows.length === 0) return json({ deduped: true }, { headers: { 'Cache-Control': 'no-store' } });
	return json({ id: rows[0].id, deduped: false }, { headers: { 'Cache-Control': 'no-store' } });
};
