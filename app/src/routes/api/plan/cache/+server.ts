import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			'SELECT query_hash, mode_id, board_val, options, computed_at, expires_at FROM route_options_cache WHERE user_id = current_user_id() AND (expires_at IS NULL OR expires_at > now()) ORDER BY computed_at DESC'
		);
	});
	return json(rows, {
		headers: { 'Cache-Control': 'no-store' }
	});
};

export const POST: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body.query_hash !== 'string' || typeof body.mode_id !== 'string' || typeof body.board_val !== 'string' || !Array.isArray(body.options)) {
		throw error(400, 'query_hash, mode_id, board_val, and options[] are required');
	}
	const expiresAt = typeof body.expires_at === 'string' ? body.expires_at : null;
	await withUser(userId, async (c) => {
		await c.query(
			`INSERT INTO route_options_cache (user_id, query_hash, mode_id, board_val, options, expires_at)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5)
			 ON CONFLICT (user_id, query_hash) DO UPDATE SET
			   mode_id = EXCLUDED.mode_id,
			   board_val = EXCLUDED.board_val,
			   options = EXCLUDED.options,
			   computed_at = now(),
			   expires_at = EXCLUDED.expires_at`,
			[body.query_hash, body.mode_id, body.board_val, body.options, expiresAt]
		);
	});
	return json({ cached: true }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
