import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import {
	exchangeCode,
	fetchGoogleProfile,
	linkGoogleIdentity,
	createSession,
	setSessionCookie,
	googleEnv,
	OAUTH_STATE_COOKIE
} from '$lib/server/auth.js';

const fail = (reason: string): never => {
	throw redirect(302, `/?login=error&reason=${reason}`);
};

export const GET: RequestHandler = async (event) => {
	const params = event.url.searchParams;
	if (params.get('error')) fail('denied');
	const code = params.get('code') ?? '';
	const state = params.get('state') ?? '';
	const expected = event.cookies.get(OAUTH_STATE_COOKIE) ?? '';
	event.cookies.delete(OAUTH_STATE_COOKIE, { path: '/' });
	if (!code || !state || !expected || state !== expected) fail('state');

	try {
		const { clientId, clientSecret } = googleEnv();
		const redirectUri = `${event.url.origin}/api/auth/google/callback`;
		const accessToken = await exchangeCode(code, clientId, clientSecret, redirectUri);
		const profile = await fetchGoogleProfile(accessToken);
		const userId = await linkGoogleIdentity(event, profile);
		setSessionCookie(event, await createSession(userId));
	} catch (err) {
		if (err instanceof Response) throw err;
		fail('exchange');
	}
	throw redirect(302, '/?login=ok');
};
