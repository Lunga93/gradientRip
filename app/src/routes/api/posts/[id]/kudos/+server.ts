// POST /api/posts/[id]/kudos — idempotent kudos (one per user), mirroring
// the route-kudos handler. INSERT ... ON CONFLICT DO NOTHING; posts.kudos
// is bumped by the trg_post_kudos_bump trigger, so no direct UPDATE here —
// that would double-count. Only visible posts can be kudosed (404 otherwise).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid post id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query(
			`SELECT id FROM posts p WHERE p.id = $1
			 AND (p.visibility = 'public' OR p.author = current_user_id()
			    OR (p.visibility = 'friends' AND is_friend(p.author))
			    OR (visibility='crew' AND is_crew_member(crew_id)))
			 AND (p.status = 'live' OR p.author = current_user_id())`,
			[id]
		);
		if (found.rows.length === 0) throw error(404, 'Post not found');
		const ins = await c.query(
			'INSERT INTO post_kudos (post_id, user_id) VALUES ($1, current_user_id()) ON CONFLICT DO NOTHING',
			[id]
		);
		const { rows } = await c.query('SELECT kudos FROM posts WHERE id = $1', [id]);
		return { kudosed: (ins.rowCount ?? 0) > 0, kudos: Number(rows[0]?.kudos) || 0 };
	});
	return json({ id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
