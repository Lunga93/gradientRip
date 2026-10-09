import { json, type RequestHandler } from '@sveltejs/kit';
import { destroySession, clearSessionCookie, SESSION_COOKIE } from '$lib/server/auth.js';

export const POST: RequestHandler = async (event) => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (token) {
		try {
			await destroySession(token);
		} catch {
		}
	}
	clearSessionCookie(event);
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
