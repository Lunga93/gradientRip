import { randomUUID } from 'node:crypto';
import { getPool } from '$lib/server/db.js';
import type { RequestEvent } from '@sveltejs/kit';

const DEVICE_COOKIE = 'gradient-device-v1';
const DEVICE_HEADER = 'x-gradient-device';

export async function getDeviceId(event: RequestEvent): Promise<string> {
	const header = event.request.headers.get(DEVICE_HEADER);
	if (header) return header;
	const cookie = event.cookies.get(DEVICE_COOKIE);
	if (cookie) return cookie;
	const id = randomUUID();
	event.cookies.set(DEVICE_COOKIE, id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365 * 10,
		secure: event.url.protocol === 'https:'
	});
	return id;
}

export async function requireUser(event: RequestEvent): Promise<string> {
	const deviceId = await getDeviceId(event);
	return resolveUser(deviceId);
}

async function resolveUser(deviceId: string): Promise<string> {
	const { rows } = await getPool().query(
		`INSERT INTO users (device_id) VALUES ($1)
		 ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
		 RETURNING id`,
		[deviceId]
	);
	return rows[0].id;
}
