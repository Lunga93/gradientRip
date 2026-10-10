// GET /api/channels/[id]/members — crew roster.
// Open crews: any signed-in user. Private crews: active members only (403 otherwise).
// PATCH /api/channels/[id]/members { user_id, action } — crew admin controls.
// Actions: 'promote' (member → admin), 'demote' (admin → member), 'remove'
// (delete the membership row; remove-on-self = leave for everyone). Non-self
// remove/promote/demote require an active admin caller (403 otherwise).
// Self-remove is allowed for any active member regardless of admin status.
// The final admin can neither be demoted nor leave:
// both paths refuse with 422 so a crew never ends up adminless (delete-crew
// stays available to that admin).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FINAL_ADMIN_MESSAGE = 'Crew needs at least one admin — promote someone first';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, visibility FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		if (found.rows[0].visibility !== 'open') {
			const member = await c.query(
				`SELECT 1 FROM channel_members
				 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
				[id]
			);
			if (member.rows.length === 0) throw error(403, 'Members only');
		}
		const { rows } = await c.query(
			`SELECT m.user_id, u.display_name, u.avatar_url, m.role, m.joined_at
			 FROM channel_members m JOIN users u ON u.id = m.user_id
			 WHERE m.channel_id = $1 AND m.status = 'active'
			 ORDER BY CASE WHEN m.role = 'admin' THEN 0 ELSE 1 END, m.joined_at ASC`,
			[id]
		);
		return {
			members: rows.map((r) => ({
				user_id: r.user_id as string,
				display_name: (r.display_name as string | null) ?? 'Rider',
				avatar_url: (r.avatar_url as string | null) ?? null,
				role: r.role as 'admin' | 'member',
				joined_at: (r.joined_at as Date).toISOString()
			}))
		};
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const body = await event.request.json().catch(() => null);
	const userId = typeof body?.user_id === 'string' ? body.user_id : '';
	const action = typeof body?.action === 'string' ? body.action : '';
	if (!UUID_RE.test(userId)) throw error(400, 'Invalid user id');
	if (action !== 'promote' && action !== 'demote' && action !== 'remove') {
		throw error(400, "action must be 'promote', 'demote', or 'remove'");
	}
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const caller = await c.query(
			`SELECT role FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		const isSelfRemove = action === 'remove' && userId === me.id;
		if (!isSelfRemove && (caller.rows.length === 0 || caller.rows[0].role !== 'admin')) {
			throw error(403, 'Crew admins only');
		}
		const target = await c.query(
			`SELECT user_id, role FROM channel_members
			 WHERE channel_id = $1 AND user_id = $2 AND status = 'active'`,
			[id, userId]
		);
		if (target.rows.length === 0) throw error(404, 'Member not found');
		const targetRole = target.rows[0].role as string;
		const isSelf = userId === me.id;
		if (action === 'promote') {
			if (targetRole === 'admin') return { ok: true, role: 'admin' };
			await c.query(
				`UPDATE channel_members SET role = 'admin'
				 WHERE channel_id = $1 AND user_id = $2`,
				[id, userId]
			);
			return { ok: true, role: 'admin' };
		}
		if (action === 'demote') {
			if (targetRole !== 'admin') throw error(400, 'User is not an admin');
			const admins = await c.query(
				`SELECT COUNT(*)::int AS count FROM channel_members
				 WHERE channel_id = $1 AND role = 'admin' AND status = 'active'`,
				[id]
			);
			if (Number(admins.rows[0].count) <= 1) throw error(422, FINAL_ADMIN_MESSAGE);
			await c.query(
				`UPDATE channel_members SET role = 'member'
				 WHERE channel_id = $1 AND user_id = $2`,
				[id, userId]
			);
			return { ok: true, role: 'member' };
		}
		// remove (self-remove = leave)
		if (isSelf && targetRole === 'admin') {
			const admins = await c.query(
				`SELECT COUNT(*)::int AS count FROM channel_members
				 WHERE channel_id = $1 AND role = 'admin' AND status = 'active'`,
				[id]
			);
			if (Number(admins.rows[0].count) <= 1) throw error(422, FINAL_ADMIN_MESSAGE);
		}
		await c.query(`DELETE FROM channel_members WHERE channel_id = $1 AND user_id = $2`, [
			id,
			userId
		]);
		return { ok: true, removed: true };
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};
