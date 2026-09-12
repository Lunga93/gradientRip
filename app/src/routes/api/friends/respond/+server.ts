// POST /api/friends/respond { userId, accept } — answer a pending request.
// Only the recipient (requested_by <> me) can respond.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const userId = typeof body?.userId === 'string' ? body.userId : '';
	const accept = body?.accept === true;
	if (!userId) throw error(400, 'userId is required');
	const updated = await withUser(me.id, async (c) => {
		const pending = await c.query(
			`SELECT 1 FROM friendships
			 WHERE status = 'pending' AND requested_by = $1
			   AND requested_by <> current_user_id()
			   AND (user_a = current_user_id() OR user_b = current_user_id())`,
			[userId]
		);
		if (pending.rows.length === 0) throw error(404, 'No pending request from that rider');
		if (accept) {
			await c.query(
				`UPDATE friendships SET status = 'accepted', updated_at = now()
				 WHERE status = 'pending' AND requested_by = $1
				   AND (user_a = current_user_id() OR user_b = current_user_id())`,
				[userId]
			);
		} else {
			await c.query(
				`DELETE FROM friendships
				 WHERE status = 'pending' AND requested_by = $1
				   AND (user_a = current_user_id() OR user_b = current_user_id())`,
				[userId]
			);
		}
		return true;
	});
	void updated;
	return json({ ok: true, accepted: accept }, { headers: { 'Cache-Control': 'no-store' } });
};
