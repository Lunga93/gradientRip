// /api/profile — the signed-in rider's own profile (name/avatar friends see).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const { rows } = await withUser(me.id, async (c) => {
		return c.query(
			`SELECT user_id, display_name, avatar_url, updated_at FROM profiles
			 WHERE user_id = current_user_id()`
		);
	});
	const row = rows[0] ?? { user_id: me.id, display_name: me.display_name, avatar_url: me.avatar_url };
	return json(
		{
			user_id: row.user_id,
			display_name: row.display_name,
			avatar_url: row.avatar_url,
			email: me.email
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const PUT: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const name = body && typeof body.display_name === 'string' ? body.display_name.trim() : '';
	if (!name || name.length > 40) throw error(400, 'display_name must be 1–40 characters');
	const { rows } = await withUser(me.id, async (c) => {
		await c.query(
			`INSERT INTO profiles (user_id, display_name) VALUES (current_user_id(), $1)
			 ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = now()`,
			[name]
		);
		await c.query('UPDATE users SET display_name = $1, updated_at = now() WHERE id = current_user_id()', [
			name
		]);
		return c.query(
			'SELECT user_id, display_name, avatar_url FROM profiles WHERE user_id = current_user_id()'
		);
	});
	return json(rows[0], { headers: { 'Cache-Control': 'no-store' } });
};
