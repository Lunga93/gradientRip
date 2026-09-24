// POST /api/channels/[id]/join — join an open channel (idempotent).
// Private channels return 403 unless the caller is already an active member.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, visibility FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const visibility = found.rows[0].visibility as string;
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (member.rows.length > 0) return { joined: false, already: true };
		if (visibility !== 'open') throw error(403, 'This channel is private — ask a member to add you');
		await c.query(
			`INSERT INTO channel_members (channel_id, user_id, role, status)
			 VALUES ($1, current_user_id(), 'member', 'active') ON CONFLICT DO NOTHING`,
			[id]
		);
		return { joined: true, already: false };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
