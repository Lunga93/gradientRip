// GET /api/friends/[userId]/trips — trips a friend explicitly shared with
// friends, shaped exactly like /api/trips rows so loadTrip() reopens them.
// 403 unless the friendship is accepted (both directions checked).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const userId = event.params.userId;
	if (!userId) throw error(400, 'userId is required');
	const limit = Math.max(1, Math.min(50, Number(event.url.searchParams.get('limit') ?? '15') || 15));
	const rows = await withUser(me.id, async (c) => {
		const rel = await c.query(
			`SELECT 1 FROM friendships
			 WHERE status = 'accepted'
			   AND ((user_a = current_user_id() AND user_b = $1)
			     OR (user_b = current_user_id() AND user_a = $1))`,
			[userId]
		);
		if (rel.rows.length === 0) throw error(403, 'You are not friends with that rider');
		const result = await c.query(
			`SELECT t.id, t.ts, t.mode_id, t.board_val, t.queries, t.coords, t.line,
			        t.pts, t.elev, t.cum, t.total_wh, t.total_climb, t.usable_wh,
			        t.climb_limit, t.brake_limit, t.total_km, t.drawn, t.recorded,
			        t.created_at, st.shared_at
			 FROM trips t JOIN shared_trips st ON st.trip_id = t.id AND st.user_id = t.user_id
			 WHERE t.user_id = $1
			 ORDER BY t.ts DESC LIMIT $2`,
			[userId, limit]
		);
		return result.rows;
	});
	return json(rows, { headers: { 'Cache-Control': 'no-store' } });
};
