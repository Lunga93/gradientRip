// POST /api/channels/[id]/join — join a channel (idempotent).
// Open channels join as today. Private channels join with a valid
// { invite } token (minted via the invite endpoint, shared as ?invite=);
// private + bad/missing token keeps today's 403 copy.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PRIVATE_MESSAGE = 'This channel is private — ask a member to add you';

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const body = await event.request.json().catch(() => null);
	const invite = typeof body?.invite === 'string' ? body.invite : '';
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, visibility, invite_token FROM channels WHERE id = $1', [
			id
		]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const visibility = found.rows[0].visibility as string;
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (member.rows.length > 0) return { joined: false, already: true };
		if (visibility === 'open') {
			await c.query(
				`INSERT INTO channel_members (channel_id, user_id, role, status)
				 VALUES ($1, current_user_id(), 'member', 'active') ON CONFLICT DO NOTHING`,
				[id]
			);
			return { joined: true, already: false };
		}
		const token = found.rows[0].invite_token as string | null;
		if (invite === '' || token === null || invite !== token) throw error(403, PRIVATE_MESSAGE);
		await c.query(
			`INSERT INTO channel_members (channel_id, user_id, role, status)
			 VALUES ($1, current_user_id(), 'member', 'active') ON CONFLICT DO NOTHING`,
			[id]
		);
		return { joined: true, already: false };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
