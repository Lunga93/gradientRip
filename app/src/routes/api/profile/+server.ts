// /api/profile — the signed-in rider's own profile (name/avatar friends see).
// Google-auth scope: display_name plus the onboarding prefs that need an
// identity (sports/units/home). Anonymous device prefs live on /api/prefs.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { parseHome, parseSports, parseUnits } from '$lib/profiles/profile.js';

const parsePrimaryUse = (v: unknown): string | null => {
	if (typeof v !== 'string') return null;
	const t = v.trim().slice(0, 60);
	return t ? t : null;
};

const toHome = (row: {
	home_lat: number | null;
	home_lon: number | null;
	home_label: string | null;
}): { lat: number; lon: number; label: string } | null =>
	row.home_lat == null || row.home_lon == null || !row.home_label
		? null
		: { lat: Number(row.home_lat), lon: Number(row.home_lon), label: row.home_label };

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const { rows } = await withUser(me.id, async (c) => {
		return c.query(
			`SELECT user_id, display_name, avatar_url, sports, home_lat, home_lon, home_label,
			        units, primary_use, updated_at FROM profiles
			 WHERE user_id = current_user_id()`
		);
	});
	const row = rows[0] ?? { user_id: me.id, display_name: me.display_name, avatar_url: me.avatar_url };
	return json(
		{
			user_id: row.user_id,
			display_name: row.display_name,
			avatar_url: row.avatar_url,
			email: me.email,
			sports: row.sports ?? [],
			home: toHome(row),
			units: row.units ?? 'km',
			primary_use: row.primary_use ?? null
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const PUT: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');

	// display_name stays validated as before but is now optional, so prefs-only
	// syncs (sports/units/home from pushBackup) don't need a name round-trip.
	const hasName = typeof body.display_name === 'string';
	const name = hasName ? body.display_name.trim() : '';
	if (hasName && (!name || name.length > 40)) throw error(400, 'display_name must be 1–40 characters');
	const sports = Array.isArray(body.sports) ? parseSports(body.sports) : null;
	const units = typeof body.units === 'string' ? parseUnits(body.units) : null;
	const home = 'home' in body ? parseHome(body.home) : undefined; // undefined = absent, null = clear
	const primary_use = parsePrimaryUse(body.primary_use);
	if (!hasName && sports === null && units === null && home === undefined && primary_use === null) {
		throw error(400, 'Nothing to update');
	}

	const { rows } = await withUser(me.id, async (c) => {
		// Row always exists for Google users (linkGoogleIdentity upserts), but
		// INSERT-first keeps prefs-only updates safe regardless.
		await c.query(
			`INSERT INTO profiles (user_id) VALUES (current_user_id()) ON CONFLICT (user_id) DO NOTHING`
		);
		if (hasName) {
			await c.query(
				`UPDATE profiles SET display_name = $1, updated_at = now() WHERE user_id = current_user_id()`,
				[name]
			);
			await c.query('UPDATE users SET display_name = $1, updated_at = now() WHERE id = current_user_id()', [
				name
			]);
		}
		const sets: string[] = [];
		const vals: unknown[] = [];
		if (sports !== null) {
			vals.push(sports);
			sets.push(`sports = $${vals.length}`);
		}
		if (units !== null) {
			vals.push(units);
			sets.push(`units = $${vals.length}`);
		}
		if (home !== undefined) {
			vals.push(home?.lat ?? null, home?.lon ?? null, home?.label ?? null);
			sets.push(`home_lat = $${vals.length - 2}, home_lon = $${vals.length - 1}, home_label = $${vals.length}`);
		}
		if (primary_use !== null) {
			vals.push(primary_use);
			sets.push(`primary_use = $${vals.length}`);
		}
		if (sets.length > 0) {
			await c.query(`UPDATE profiles SET ${sets.join(', ')}, updated_at = now() WHERE user_id = current_user_id()`, vals);
		}
		return c.query(
			'SELECT user_id, display_name, avatar_url, sports, home_lat, home_lon, home_label, units, primary_use FROM profiles WHERE user_id = current_user_id()'
		);
	});
	const row = rows[0];
	return json(
		{
			user_id: row.user_id,
			display_name: row.display_name,
			avatar_url: row.avatar_url,
			sports: row.sports ?? [],
			home: toHome(row),
			units: row.units ?? 'km',
			primary_use: row.primary_use ?? null
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
