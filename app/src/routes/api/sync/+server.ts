import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

const VALID_THEMES = new Set(['auto', 'light', 'dark']);

function isNumberArray(v: unknown): boolean {
	return Array.isArray(v) && v.every((x) => typeof x === 'number');
}

function validateKnownLocation(v: unknown): { lat: number; lon: number; label: string; ts: number } | null {
	if (!v || typeof v !== 'object') return null;
	const loc = v as Record<string, unknown>;
	if (typeof loc.lat !== 'number' || typeof loc.lon !== 'number' || typeof loc.label !== 'string' || typeof loc.ts !== 'number') return null;
	return { lat: loc.lat, lon: loc.lon, label: loc.label, ts: loc.ts };
}

export const POST: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');

	const result: Record<string, number> = {};

	if (Array.isArray(body.presets)) {
		for (const p of body.presets) {
			if (!p || typeof p.label !== 'string' || typeof p.query !== 'string') continue;
			const coords = Array.isArray(p.coords) && p.coords.length === 2 && typeof p.coords[0] === 'number' && typeof p.coords[1] === 'number' ? p.coords : null;
			await withUser(userId, async (c) => {
				await c.query(
					`INSERT INTO presets (user_id, label, query, coords) VALUES (current_user_id(), $1, $2, $3)
					 ON CONFLICT (user_id, label, query) DO UPDATE SET coords = EXCLUDED.coords, updated_at = now()`,
					[p.label.trim(), p.query.trim(), coords]
				);
			});
		}
		result.presets = body.presets.length;
	}

	if (Array.isArray(body.trips)) {
		for (const t of body.trips) {
			if (!t || typeof t !== 'object') continue;
			if (typeof t.ts !== 'number' || typeof t.modeId !== 'string' || typeof t.boardVal !== 'string') continue;
			const queries = Array.isArray(t.queries) ? t.queries : [];
			const coords = isNumberArray(t.coords) ? t.coords : [];
			const line = isNumberArray(t.line) ? t.line : [];
			const pts = isNumberArray(t.pts) ? t.pts : [];
			const elev = isNumberArray(t.elev) ? t.elev : [];
			const cum = typeof t.cum === 'object' && t.cum !== null ? t.cum : {};
			await withUser(userId, async (c) => {
				await c.query(
					`INSERT INTO trips (user_id, ts, mode_id, board_val, queries, coords, line, pts, elev, cum, total_wh, total_climb, usable_wh, climb_limit, brake_limit, total_km, drawn, recorded)
					 VALUES (current_user_id(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
					 ON CONFLICT (user_id, ts) DO UPDATE SET
					   mode_id = EXCLUDED.mode_id,
					   board_val = EXCLUDED.board_val,
					   queries = EXCLUDED.queries,
					   coords = EXCLUDED.coords,
					   line = EXCLUDED.line,
					   pts = EXCLUDED.pts,
					   elev = EXCLUDED.elev,
					   cum = EXCLUDED.cum,
					   total_wh = EXCLUDED.total_wh,
					   total_climb = EXCLUDED.total_climb,
					   usable_wh = EXCLUDED.usable_wh,
					   climb_limit = EXCLUDED.climb_limit,
					   brake_limit = EXCLUDED.brake_limit,
					   total_km = EXCLUDED.total_km,
					   drawn = EXCLUDED.drawn,
					   recorded = EXCLUDED.recorded,
					   updated_at = now()`,
					[t.ts, t.modeId, t.boardVal, queries, coords, line, pts, elev, cum, t.totalWh, t.totalClimb, t.usableWh, t.climbLimit, t.brakeLimit, t.totalKm, t.drawn ?? false, t.recorded ?? false]
				);
			});
		}
		result.trips = body.trips.length;
	}

	if (body.prefs && typeof body.prefs === 'object') {
		const p = body.prefs;
		const transport_mode = typeof p.transport_mode === 'string' ? p.transport_mode : null;
		const board = typeof p.board === 'string' ? p.board : null;
		const theme = typeof p.theme === 'string' && VALID_THEMES.has(p.theme) ? p.theme : null;
		const legal_dismissed = typeof p.legal_dismissed === 'boolean' ? p.legal_dismissed : null;
		const known_location = validateKnownLocation(p.known_location);
		await withUser(userId, async (c) => {
			await c.query(
				`INSERT INTO prefs (user_id, transport_mode, board, theme, legal_dismissed, known_location)
				 VALUES (current_user_id(), $1, $2, $3, $4, $5)
				 ON CONFLICT (user_id) DO UPDATE SET
				   transport_mode = COALESCE(EXCLUDED.transport_mode, prefs.transport_mode),
				   board = COALESCE(EXCLUDED.board, prefs.board),
				   theme = COALESCE(EXCLUDED.theme, prefs.theme),
				   legal_dismissed = COALESCE(EXCLUDED.legal_dismissed, prefs.legal_dismissed),
				   known_location = COALESCE(EXCLUDED.known_location, prefs.known_location),
				   updated_at = now()`,
				[transport_mode, board, theme, legal_dismissed, known_location]
			);
		});
		result.prefs = 1;
	}

	return json({ synced: result }, { headers: { 'Cache-Control': 'no-store' } });
};
