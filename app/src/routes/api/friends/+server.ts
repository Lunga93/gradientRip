// /api/friends — GET lists accepted friends (with live fixes attached) plus
// pending incoming/outgoing requests. POST { email } sends a request.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { canonicalPair, normalizeEmail, listFriends, listPending } from '$lib/server/friends.js';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => ({
		friends: await listFriends(c),
		incoming: await listPending(c, true),
		outgoing: await listPending(c, false)
	}));
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const email = normalizeEmail(body?.email);
	if (!email) throw error(400, 'A valid email address is required');
	const result = await withUser(me.id, async (c) => {
		const found = await c.query(
			'SELECT id FROM users WHERE lower(email) = $1 AND google_id IS NOT NULL',
			[email]
		);
		if (found.rows.length === 0) {
			throw error(404, 'No rider found with that email — they need to sign in with Google first');
		}
		const other = found.rows[0].id as string;
		if (other === me.id) throw error(400, 'You cannot add yourself as a friend');
		const existing = await c.query(
			`SELECT status, requested_by FROM friendships
			 WHERE (user_a = current_user_id() AND user_b = $1)
			    OR (user_a = $1 AND user_b = current_user_id())`,
			[other]
		);
		if (existing.rows.length > 0) {
			const row = existing.rows[0] as { status: string; requested_by: string };
			if (row.status === 'accepted') return { status: 'accepted' as const };
			if (row.status === 'blocked') throw error(403, 'This rider is unavailable');
			// They already asked me → accept on the spot (mutual intent).
			if (row.requested_by === other) {
				await c.query(
					`UPDATE friendships SET status = 'accepted', updated_at = now()
					 WHERE (user_a = current_user_id() AND user_b = $1)
					    OR (user_a = $1 AND user_b = current_user_id())`,
					[other]
				);
				return { status: 'accepted' as const };
			}
			return { status: 'pending' as const };
		}
		const [a, b] = canonicalPair(me.id, other);
		await c.query(
			`INSERT INTO friendships (user_a, user_b, status, requested_by)
			 VALUES ($1, $2, 'pending', current_user_id())`,
			[a, b]
		);
		return { status: 'pending' as const };
	});
	return json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
};
