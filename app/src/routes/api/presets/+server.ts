import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const { rows } = await withUser(userId, async (c) => {
		return c.query('SELECT id, label, query, coords, created_at FROM presets WHERE user_id = current_user_id() ORDER BY created_at DESC');
	});
	return json(rows, {
		headers: { 'Cache-Control': 'no-store' }
	});
};

export const POST: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.label !== 'string' || typeof body.query !== 'string' || !body.label.trim() || !body.query.trim()) {
		throw error(400, 'label and query are required strings');
	}
	const coords = Array.isArray(body.coords) && body.coords.length === 2 && typeof body.coords[0] === 'number' && typeof body.coords[1] === 'number' ? body.coords : null;
	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			'INSERT INTO presets (user_id, label, query, coords) VALUES (current_user_id(), $1, $2, $3) RETURNING id, label, query, coords, created_at',
			[body.label.trim(), body.query.trim(), coords]
		);
	});
	return json(rows[0], { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
