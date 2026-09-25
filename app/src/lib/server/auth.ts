
import { createHash, randomBytes } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { error, type RequestEvent } from '@sveltejs/kit';
import { getPool } from '$lib/server/db.js';
import { getDeviceId, requireUser } from '$lib/server/device.js';

export const SESSION_COOKIE = 'gradient-session-v1';
export const OAUTH_STATE_COOKIE = 'gradient-oauth-state';
export const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export interface GoogleProfile {
	sub: string;
	email: string;
	name: string;
	picture: string;
}

export interface AuthUser {
	id: string;
	email: string | null;
	display_name: string | null;
	avatar_url: string | null;
	google_id: string | null;
}


export const hashToken = (token: string): string =>
	createHash('sha256').update(token, 'utf8').digest('hex');

export const newToken = (): string => randomBytes(32).toString('hex');

export const buildGoogleAuthUrl = (clientId: string, redirectUri: string, state: string): string => {
	const params = new URLSearchParams({
		client_id: clientId,
		redirect_uri: redirectUri,
		response_type: 'code',
		scope: 'openid email profile',
		state,
		access_type: 'online',
		prompt: 'select_account'
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const validateGoogleProfile = (v: unknown): GoogleProfile | null => {
	if (!v || typeof v !== 'object') return null;
	const p = v as Record<string, unknown>;
	if (typeof p.sub !== 'string' || !p.sub) return null;
	if (typeof p.email !== 'string' || !p.email.includes('@')) return null;
	return {
		sub: p.sub,
		email: p.email,
		name: typeof p.name === 'string' && p.name ? p.name : p.email.split('@')[0],
		picture: typeof p.picture === 'string' ? p.picture : ''
	};
};


export const exchangeCode = async (
	code: string,
	clientId: string,
	clientSecret: string,
	redirectUri: string
): Promise<string> => {
	const resp = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: clientId,
			client_secret: clientSecret,
			redirect_uri: redirectUri,
			grant_type: 'authorization_code'
		}).toString()
	});
	if (!resp.ok) throw error(502, 'Google token exchange failed');
	const data = (await resp.json().catch(() => null)) as Record<string, unknown> | null;
	if (!data || typeof data.access_token !== 'string' || !data.access_token) {
		throw error(502, 'Google returned no access token');
	}
	return data.access_token;
};

export const fetchGoogleProfile = async (accessToken: string): Promise<GoogleProfile> => {
	const resp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
		headers: { Authorization: `Bearer ${accessToken}` }
	});
	if (!resp.ok) throw error(502, 'Google userinfo lookup failed');
	const profile = validateGoogleProfile(await resp.json().catch(() => null));
	if (!profile) throw error(502, 'Google returned an invalid profile');
	return profile;
};


export const createSession = async (userId: string): Promise<string> => {
	const token = newToken();
	await getPool().query(
		`INSERT INTO oauth_sessions (user_id, token_hash, expires_at)
		 VALUES ($1, $2, now() + make_interval(secs => $3))`,
		[userId, hashToken(token), SESSION_TTL_MS / 1000]
	);
	return token;
};

export const destroySession = async (token: string): Promise<void> => {
	await getPool().query('DELETE FROM oauth_sessions WHERE token_hash = $1', [hashToken(token)]);
};

export const setSessionCookie = (event: RequestEvent, token: string): void => {
	event.cookies.set(SESSION_COOKIE, token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: SESSION_TTL_MS / 1000,
		secure: event.url.protocol === 'https:'
	});
};

export const clearSessionCookie = (event: RequestEvent): void => {
	event.cookies.delete(SESSION_COOKIE, { path: '/' });
};

export const requireAuth = async (event: RequestEvent): Promise<AuthUser> => {
	const token = event.cookies.get(SESSION_COOKIE);
	if (!token) throw error(401, 'Sign in with Google to use friends');
	const { rows } = await getPool().query(
		`SELECT u.id, u.email, u.display_name, u.avatar_url, u.google_id
		 FROM oauth_sessions s JOIN users u ON u.id = s.user_id
		 WHERE s.token_hash = $1 AND s.expires_at > now()`,
		[hashToken(token)]
	);
	if (rows.length === 0) throw error(401, 'Session expired — sign in again');
	const user = rows[0] as AuthUser;
	if (!user.google_id) throw error(401, 'Sign in with Google to use friends');
	void getPool()
		.query(
			`UPDATE oauth_sessions SET expires_at = now() + make_interval(secs => $2)
			 WHERE token_hash = $1 AND expires_at < now() + make_interval(secs => $2) / 2`,
			[hashToken(token), SESSION_TTL_MS / 1000]
		)
		.catch(() => {});
	return user;
};

export const getAuthUser = async (event: RequestEvent): Promise<AuthUser | null> => {
	try {
		return await requireAuth(event);
	} catch {
		return null;
	}
};

// Resolve the effective user id for device-scoped endpoints (sync, trips,
// presets): prefer the Google identity when signed in, so every device writes
// to the same row that share/friends read. Anonymous users keep working
// untouched on their device row.
//
// When the signed-in Google row differs from this device's row (second
// device, or seeded users that were never linked at login), data stranded on
// the anonymous device row is folded into the Google row — the same merge
// first-login linking performs. Without this, trips pushed from an unlinked
// device are invisible to /api/trips/share ("Trip not found").
export const resolveUserId = async (event: RequestEvent): Promise<string> => {
	const authed = await getAuthUser(event);
	if (!authed) return requireUser(event);
	const pool = getPool();
	const deviceId = await getDeviceId(event);
	const { rows } = await pool.query('SELECT id, google_id FROM users WHERE device_id = $1', [
		deviceId
	]);
	const deviceRow = rows[0] as { id: string; google_id: string | null } | undefined;
	if (!deviceRow || deviceRow.id === authed.id || deviceRow.google_id) return authed.id;
	const stranded = await pool.query(
		'SELECT (SELECT count(*) FROM trips WHERE user_id = $1) AS trips, (SELECT count(*) FROM presets WHERE user_id = $1) AS presets',
		[deviceRow.id]
	);
	if (stranded.rows[0].trips === '0' && stranded.rows[0].presets === '0') return authed.id;
	await pool.query('BEGIN');
	try {
		await pool.query(
			`INSERT INTO trips (user_id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum,
			   total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded)
			 SELECT $1, ts, mode_id, board_val, queries, coords, line, pts, elev, cum,
			   total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded
			 FROM trips WHERE user_id = $2
			 ON CONFLICT (user_id, ts) DO NOTHING`,
			[authed.id, deviceRow.id]
		);
		await pool.query(
			`INSERT INTO shared_trips (trip_id, user_id)
			 SELECT g.id, $1 FROM trips g JOIN trips d ON d.ts = g.ts
			 WHERE g.user_id = $1 AND d.user_id = $2
			 AND EXISTS (SELECT 1 FROM shared_trips s WHERE s.trip_id = d.id)
			 ON CONFLICT DO NOTHING`,
			[authed.id, deviceRow.id]
		);
		await pool.query('DELETE FROM shared_trips WHERE user_id = $1', [deviceRow.id]);
		await pool.query('DELETE FROM trips WHERE user_id = $1', [deviceRow.id]);
		await pool.query(
			`INSERT INTO presets (user_id, label, query, coords)
			 SELECT $1, label, query, coords FROM presets WHERE user_id = $2
			 ON CONFLICT (user_id, label, query) DO UPDATE SET coords = EXCLUDED.coords, updated_at = now()`,
			[authed.id, deviceRow.id]
		);
		await pool.query('DELETE FROM presets WHERE user_id = $1', [deviceRow.id]);
		await pool.query('COMMIT');
	} catch (e) {
		await pool.query('ROLLBACK');
		throw e;
	}
	return authed.id;
};

/* ---------- identity linking ---------- */

export const linkGoogleIdentity = async (
	event: RequestEvent,
	profile: GoogleProfile
): Promise<string> => {
	const pool = getPool();
	const byGoogle = await pool.query('SELECT id FROM users WHERE google_id = $1', [profile.sub]);
	if (byGoogle.rows.length > 0) {
		const id = byGoogle.rows[0].id as string;
		await pool.query(
			`UPDATE users SET email = $2, display_name = COALESCE(display_name, $3),
			 avatar_url = COALESCE(avatar_url, $4), updated_at = now() WHERE id = $1`,
			[id, profile.email, profile.name, profile.picture || null]
		);
		await upsertProfile(id, profile.name, profile.picture);
		return id;
	}
	const deviceId = await getDeviceId(event);
	const byDevice = await pool.query('SELECT id, google_id FROM users WHERE device_id = $1', [
		deviceId
	]);
	if (byDevice.rows.length > 0 && !byDevice.rows[0].google_id) {
		const id = byDevice.rows[0].id as string;
		await pool.query(
			`UPDATE users SET google_id = $2, email = $3, display_name = $4,
			 avatar_url = $5, updated_at = now() WHERE id = $1`,
			[id, profile.sub, profile.email, profile.name, profile.picture || null]
		);
		await upsertProfile(id, profile.name, profile.picture);
		return id;
	}
	const created = await pool.query(
		`INSERT INTO users (google_id, email, display_name, avatar_url)
		 VALUES ($1, $2, $3, $4) RETURNING id`,
		[profile.sub, profile.email, profile.name, profile.picture || null]
	);
	const id = created.rows[0].id as string;
	await upsertProfile(id, profile.name, profile.picture);
	return id;
};

const upsertProfile = async (userId: string, name: string, picture: string): Promise<void> => {
	await getPool().query(
		`INSERT INTO profiles (user_id, display_name, avatar_url)
		 VALUES ($1, $2, $3)
		 ON CONFLICT (user_id) DO UPDATE SET
		   display_name = COALESCE(profiles.display_name, EXCLUDED.display_name),
		   avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
		   updated_at = now()`,
		[userId, name, picture || null]
	);
};

export const googleEnv = (): { clientId: string; clientSecret: string } => {
	const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
	const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
	if (!clientId || !clientSecret) throw error(503, 'Google sign-in is not configured on this server');
	return { clientId, clientSecret };
};
