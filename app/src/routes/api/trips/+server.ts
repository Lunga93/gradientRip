import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const limit = Math.max(1, Math.min(200, Number(event.url.searchParams.get('limit') ?? '50') || 50));
	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			'SELECT id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded, created_at FROM trips WHERE user_id = current_user_id() ORDER BY ts DESC LIMIT $1',
			[limit]
		);
	});
	return json(rows, {
		headers: { 'Cache-Control': 'no-store' }
	});
};

export const POST: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body) throw error(400, 'Invalid JSON body');

	const required = ['ts', 'modeId', 'boardVal', 'totalWh', 'totalClimb', 'usableWh', 'climbLimit', 'brakeLimit', 'totalKm'];
	for (const key of required) {
		if (typeof body[key] !== 'number') throw error(400, `${key} is required and must be a number`);
	}
	if (!Array.isArray(body.queries)) throw error(400, 'queries must be an array');
	if (!Array.isArray(body.coords)) throw error(400, 'coords must be an array');
	if (!Array.isArray(body.line)) throw error(400, 'line must be an array');
	if (!Array.isArray(body.pts)) throw error(400, 'pts must be an array');
	if (!Array.isArray(body.elev)) throw error(400, 'elev must be an array');
	if (typeof body.cum !== 'object' || body.cum === null) throw error(400, 'cum must be an object');
	if (typeof body.drawn !== 'boolean') throw error(400, 'drawn must be a boolean');
	if (typeof body.recorded !== 'boolean') throw error(400, 'recorded must be a boolean');

	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			`INSERT INTO trips (user_id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
			 RETURNING id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded, created_at`,
			[body.ts, body.modeId, body.boardVal, body.queries, body.coords, body.line, body.pts, body.elev, body.cum, body.totalWh, body.totalClimb, body.usableWh, body.climbLimit, body.brakeLimit, body.totalKm, body.drawn, body.recorded]
		);
	});
	return json(rows[0], { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
