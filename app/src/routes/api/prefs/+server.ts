import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

const VALID_THEMES = new Set(['auto', 'light', 'dark']);

function validateKnownLocation(v: unknown): { lat: number; lon: number; label: string; ts: number } | null {
	if (!v || typeof v !== 'object') return null;
	const loc = v as Record<string, unknown>;
	if (typeof loc.lat !== 'number' || typeof loc.lon !== 'number' || typeof loc.label !== 'string' || typeof loc.ts !== 'number') return null;
	return { lat: loc.lat, lon: loc.lon, label: loc.label, ts: loc.ts };
}

export const GET: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const { rows } = await withUser(userId, async (c) => {
		return c.query('SELECT transport_mode, board, theme, legal_dismissed, known_location FROM prefs WHERE user_id = current_user_id()');
	});
	if (rows.length === 0) {
		return json({ transport_mode: null, board: null, theme: 'auto', legal_dismissed: false, known_location: null }, {
			headers: { 'Cache-Control': 'no-store' }
		});
	}
	const p = rows[0];
	return json({
		transport_mode: p.transport_mode,
		board: p.board,
		theme: p.theme,
		legal_dismissed: p.legal_dismissed,
		known_location: p.known_location
	}, {
		headers: { 'Cache-Control': 'no-store' }
	});
};

export const PUT: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const body = await event.request.json().catch(() => null);
	if (!body || typeof body !== 'object') throw error(400, 'Invalid JSON body');

	const transport_mode = typeof body.transport_mode === 'string' ? body.transport_mode : null;
	const board = typeof body.board === 'string' ? body.board : null;
	const theme = typeof body.theme === 'string' && VALID_THEMES.has(body.theme) ? body.theme : null;
	const legal_dismissed = typeof body.legal_dismissed === 'boolean' ? body.legal_dismissed : null;
	const known_location = validateKnownLocation(body.known_location);

	const { rows } = await withUser(userId, async (c) => {
		return c.query(
			`INSERT INTO prefs (user_id, transport_mode, board, theme, legal_dismissed, known_location)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5)
			 ON CONFLICT (user_id) DO UPDATE SET
			   transport_mode = COALESCE(EXCLUDED.transport_mode, prefs.transport_mode),
			   board = COALESCE(EXCLUDED.board, prefs.board),
			   theme = COALESCE(EXCLUDED.theme, prefs.theme),
			   legal_dismissed = COALESCE(EXCLUDED.legal_dismissed, prefs.legal_dismissed),
			   known_location = COALESCE(EXCLUDED.known_location, prefs.known_location),
			   updated_at = now()
			 RETURNING transport_mode, board, theme, legal_dismissed, known_location`,
			[transport_mode, board, theme, legal_dismissed, known_location]
		);
	});
	return json(rows[0], { headers: { 'Cache-Control': 'no-store' } });
};
