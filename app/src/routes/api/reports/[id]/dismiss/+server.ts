// POST /api/reports/[id]/dismiss — crew-admin dismiss (Phase D Task 4).
// Crew-post linkage (found in 20261007000001_crews.up.sql):
// posts.crew_id REFERENCES channels(id), with an exactly-one CHECK pairing
// visibility = 'crew' ⟺ crew_id NOT NULL (public/friends ⟺ crew_id IS NULL).
//
// Dismiss rule (binding): allowed IFF the caller is an ACTIVE admin of the
// post's crew — crew posts only. Public/friends posts have no dismiss path
// (the author remedies by deleting the post — there is no post-edit
// endpoint); route/event targets have no crew linkage and likewise no dismiss
// path (400). The admin gate below is the members-PATCH gate verbatim:
//   SELECT role FROM channel_members
//   WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'
// requiring role = 'admin', else 403 'Crew admins only' (same copy).
// Note the author is NOT special-cased: an author who is not a crew admin
// gets 403 here and must delete instead — dismiss-without-fix is admin-only.
//
// Reset choice (plan "resetting the counter"): one txn DELETEs every report
// row for the target (the hide triggers count DISTINCT reporters, so deleting
// rows resets the counter), sets posts.hidden = false, and writes one
// moderation_log row (target_kind 'post', action 'dismiss',
// actor current_user_id()) — auditability over cleverness.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid report id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query(
			'SELECT id, target_kind, target_id FROM reports WHERE id = $1',
			[id]
		);
		if (found.rows.length === 0) throw error(404, 'Report not found');
		const targetKind = found.rows[0].target_kind as string;
		const targetId = found.rows[0].target_id as string;
		// Only crew-post reports carry a crew whose admin can dismiss.
		if (targetKind !== 'post') throw error(400, 'Only post reports can be dismissed');
		const post = await c.query('SELECT id, visibility, crew_id FROM posts WHERE id = $1', [
			targetId
		]);
		if (post.rows.length === 0) throw error(404, 'Post not found');
		const crewId = post.rows[0].crew_id as string | null;
		if (post.rows[0].visibility !== 'crew' || crewId === null) {
			throw error(403, 'Dismiss is only available for crew posts — edit or delete the post instead');
		}
		const caller = await c.query(
			`SELECT role FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[crewId]
		);
		if (caller.rows.length === 0 || caller.rows[0].role !== 'admin') {
			throw error(403, 'Crew admins only');
		}
		await c.query(`DELETE FROM reports WHERE target_kind = 'post' AND target_id = $1`, [
			targetId
		]);
		await c.query('UPDATE posts SET hidden = false WHERE id = $1', [targetId]);
		await c.query(
			`INSERT INTO moderation_log (target_kind, target_id, actor, action)
			 VALUES ('post', $1, current_user_id(), 'dismiss')`,
			[targetId]
		);
		return { post_id: targetId };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
