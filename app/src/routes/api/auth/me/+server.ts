import { json, type RequestHandler } from '@sveltejs/kit';
import { getAuthUser } from '$lib/server/auth.js';

export const GET: RequestHandler = async (event) => {
	const user = await getAuthUser(event);
	return json({ user }, { headers: { 'Cache-Control': 'no-store' } });
};
