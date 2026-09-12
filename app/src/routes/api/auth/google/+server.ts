// GET /api/auth/google — start Google sign-in: stash a CSRF state cookie,
// then bounce the browser to Google's consent screen.
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { randomBytes } from 'node:crypto';
import { buildGoogleAuthUrl, googleEnv, OAUTH_STATE_COOKIE } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const { clientId } = googleEnv();
	const state = randomBytes(16).toString('hex');
	event.cookies.set(OAUTH_STATE_COOKIE, state, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 600,
		secure: event.url.protocol === 'https:'
	});
	const redirectUri = `${event.url.origin}/api/auth/google/callback`;
	throw redirect(302, buildGoogleAuthUrl(clientId, redirectUri, state));
};
