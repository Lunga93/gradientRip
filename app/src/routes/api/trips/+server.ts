import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

export const GET: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const limit = Math.max(1, Math.min(200, Number(event.url.searchParams.get('limit') ?? '50') || 50));
	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			`SELECT t.id, t.ts, t.mode_id, t.board_val, t.queries, t.coords, t.line, t.pts,
			        t.elev, t.cum, t.total_wh, t.total_climb, t.usable_wh, t.climb_limit,
			        t.brake_limit, t.total_km, t.drawn, t.recorded, t.created_at,
			        (st.trip_id IS NOT NULL) AS shared
			 FROM trips t LEFT JOIN shared_trips st ON st.trip_id = t.id AND st.user_id = t.user_id
			 WHERE t.user_id = current_user_id() ORDER BY t.ts DESC LIMIT $1`,
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

	const requiredNumbers = ['ts', 'totalWh', 'totalClimb', 'usableWh', 'climbLimit', 'brakeLimit', 'totalKm'];
	for (const key of requiredNumbers) {
		if (typeof body[key] !== 'number') throw error(400, `${key} is required and must be a number`);
	}
	for (const key of ['modeId', 'boardVal']) {
		if (typeof body[key] !== 'string' || !body[key]) throw error(400, `${key} is required and must be a string`);
	}
	if (!Array.isArray(body.queries)) throw error(400, 'queries must be an array');
	if (!Array.isArray(body.coords)) throw error(400, 'coords must be an array');
	if (!Array.isArray(body.line)) throw error(400, 'line must be an array');
	if (!Array.isArray(body.pts)) throw error(400, 'pts must be an array');
	if (!Array.isArray(body.elev)) throw error(400, 'elev must be an array');
	if (!Array.isArray(body.cum)) throw error(400, 'cum must be an array');
	// drawn/recorded are optional flags — planned trips carry neither.
	if (body.drawn !== undefined && typeof body.drawn !== 'boolean') throw error(400, 'drawn must be a boolean');
	if (body.recorded !== undefined && typeof body.recorded !== 'boolean') throw error(400, 'recorded must be a boolean');

	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			`INSERT INTO trips (user_id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
			 RETURNING id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded, created_at`,
			[body.ts, body.modeId, body.boardVal, body.queries, JSON.stringify(body.coords), JSON.stringify(body.line), JSON.stringify(body.pts), JSON.stringify(body.elev), JSON.stringify(body.cum), body.totalWh, body.totalClimb, body.usableWh, body.climbLimit, body.brakeLimit, body.totalKm, body.drawn ?? false, body.recorded ?? false]
		);
	});
	return json(rows[0], { status: 201, headers: { 'Cache-Control': 'no-store' } });
};
