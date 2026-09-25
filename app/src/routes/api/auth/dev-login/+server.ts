// GET /api/auth/dev-login — LOCAL DEVELOPMENT ONLY.
// One-click sign-in as a seeded dummy user, so testers never touch Google OAuth.
// Triple-guarded: (1) `dev` is false in production builds → 404; (2) requires
// DEV_LOGIN_TOKEN env to be set; (3) the ?token= param must match it exactly.
// Looks the user up by ?email= (must already exist with a google_id, e.g. via
// /tmp/seed-dummy.mjs), mints a session, sets the cookie, redirects home.
import { error, redirect, type RequestHandler } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getPool } from '$lib/server/db.js';
import { createSession, setSessionCookie } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	if (!dev) throw error(404, 'Not found');
	const expected = env.DEV_LOGIN_TOKEN || '';
	if (!expected) throw error(503, 'DEV_LOGIN_TOKEN is not set on this server');
	const token = event.url.searchParams.get('token') || '';
	const email = (event.url.searchParams.get('email') || '').trim().toLowerCase();
	if (token !== expected || !email) throw error(403, 'Bad dev-login token or email');
	const { rows } = await getPool().query('SELECT id, google_id FROM users WHERE email = $1', [email]);
	if (rows.length === 0 || !rows[0].google_id) throw error(404, 'No such dummy user — run the seeder first');
	const session = await createSession(rows[0].id as string);
	setSessionCookie(event, session);
	throw redirect(302, '/');
};
