// POST /api/auth/logout — kill the server session and clear the cookie.
import { json, type RequestHandler } from '@sveltejs/kit';
import { destroySession, clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		try {
			await destroySession(token);
		} catch {
			/* session already gone — cookie clear below still logs out */
		}
	}
	clearSessionCookie(event);
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
