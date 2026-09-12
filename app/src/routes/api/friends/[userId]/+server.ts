// DELETE /api/friends/[userId] — remove a friend (any status, either side).
// Also clears their live row visibility implicitly via the friendship check.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const DELETE: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const userId = event.params.userId;
	if (!userId) throw error(400, 'userId is required');
	const removed = await withUser(me.id, async (c) => {
		const result = await c.query(
			`DELETE FROM friendships
			 WHERE (user_a = current_user_id() AND user_b = $1)
			    OR (user_a = $1 AND user_b = current_user_id())`,
			[userId]
		);
		return (result.rowCount ?? 0) > 0;
	});
	if (!removed) throw error(404, 'Not friends with that rider');
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
