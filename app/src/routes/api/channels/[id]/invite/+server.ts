// /api/channels/[id]/invite — crew invite links (mirrors the events
// regenerate_invite pattern: tokens are encode(gen_random_bytes(12), 'hex')).
// POST mints/rotates the link (any active member); DELETE revokes it to NULL
// (active admins only). The token is returned to the caller and never logged.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (member.rows.length === 0) throw error(403, 'Members only');
		const { rows } = await c.query(
			`UPDATE channels SET invite_token = encode(gen_random_bytes(12), 'hex')
			 WHERE id = $1 RETURNING invite_token`,
			[id]
		);
		return { invite_token: rows[0].invite_token as string };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const caller = await c.query(
			`SELECT role FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (caller.rows.length === 0 || caller.rows[0].role !== 'admin') {
			throw error(403, 'Crew admins only');
		}
		await c.query('UPDATE channels SET invite_token = NULL WHERE id = $1', [id]);
	});
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
