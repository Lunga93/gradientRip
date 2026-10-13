// POST /api/routes/[id]/hazards { kind, lat?, lon?, note?, expires_days? } —
// report a hazard on an open route.
//
// Signed-in only. kind must be a HAZARD_KINDS value (closed-sets.ts — the TS
// half of the hazards CHECK in 20261011000001_safety.up.sql; compared against
// the const, never a literal). note trims to NULL when empty, else 1–280 chars
// (posts/reports copy: 'reason must be 1-500 chars' → 'note must be 1-280
// chars'). lat/lon arrive as a pair or not at all (route-wide hazard when
// absent); a pin must sit within 2 km of a route line vertex (haversine, in
// meters) else 400 'Pin is too far from this route'. expires_days is 7|30,
// default 30 → expires_at = now() + days. The route must be open
// (hidden = false) else 404 — same shape as the kudos/save handlers.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { haversine } from '$lib/util.js';
import { HAZARD_KINDS } from '$lib/hazards.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Pin proximity: a reported pin must fall within this distance (meters) of a
// route line vertex (plan §5 — the planner's 200 m corridor in Task 3 is a
// separate, intentional threshold).
const PIN_MAX_M = 2000;
const DEFAULT_EXPIRES_DAYS = 30;

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// Narrow the route's JSONB line to [lat, lon] vertices; unparseable entries
// are skipped (an empty result rejects any pin below as too far).
const parseLine = (line: unknown): [number, number][] => {
	if (!Array.isArray(line)) return [];
	const out: [number, number][] = [];
	for (const p of line) {
		if (Array.isArray(p) && p.length >= 2 && isFiniteNum(p[0]) && isFiniteNum(p[1])) {
			out.push([p[0], p[1]]);
		}
	}
	return out;
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid route id');
	const body = await event.request.json().catch(() => null);

	const kind = typeof body?.kind === 'string' ? body.kind : '';
	if (!(HAZARD_KINDS as readonly string[]).includes(kind)) {
		const names = HAZARD_KINDS.map((k) => `'${k}'`);
		throw error(400, `kind must be ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`);
	}

	// Note: optional; empty/whitespace-only collapses to NULL, else 1–280.
	let note: string | null = null;
	if (body?.note !== undefined && body?.note !== null) {
		if (typeof body.note !== 'string') throw error(400, 'note must be 1-280 chars');
		const trimmed = body.note.trim();
		if (trimmed.length > 280) throw error(400, 'note must be 1-280 chars');
		note = trimmed.length === 0 ? null : trimmed;
	}

	// Pin: lat+lon together (hazard pin) or neither (route-wide hazard).
	const hasLat = body?.lat !== undefined && body?.lat !== null;
	const hasLon = body?.lon !== undefined && body?.lon !== null;
	if (hasLat !== hasLon) throw error(400, 'lat and lon must be provided together');
	let pin: [number, number] | null = null;
	if (hasLat && hasLon) {
		const lat = Number(body.lat);
		const lon = Number(body.lon);
		if (!Number.isFinite(lat) || lat < -90 || lat > 90) throw error(400, 'lat must be in [-90, 90]');
		if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
			throw error(400, 'lon must be in [-180, 180]');
		}
		pin = [lat, lon];
	}

	let expiresDays = DEFAULT_EXPIRES_DAYS;
	if (body?.expires_days !== undefined && body?.expires_days !== null) {
		const days = Number(body.expires_days);
		if (days !== 7 && days !== 30) throw error(400, 'expires_days must be 7 or 30');
		expiresDays = days;
	}

	const hazard = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, line FROM public_routes WHERE id = $1 AND hidden = false', [
			id
		]);
		if (found.rows.length === 0) throw error(404, 'Route not found');
		if (pin !== null) {
			const here: [number, number] = pin;
			let nearest = Infinity;
			for (const v of parseLine(found.rows[0].line)) {
				const d = haversine(here, v);
				if (d < nearest) nearest = d;
			}
			if (!Number.isFinite(nearest) || nearest > PIN_MAX_M) {
				throw error(400, 'Pin is too far from this route');
			}
		}
		const { rows } = await c.query(
			`INSERT INTO hazards (route_id, reporter, kind, lat, lon, note, expires_at)
			 VALUES ($1, current_user_id(), $2, $3, $4, $5, now() + make_interval(days => $6))
			 RETURNING id, kind, lat, lon, note, confirmations, expires_at, created_at`,
			[id, kind, pin?.[0] ?? null, pin?.[1] ?? null, note, expiresDays]
		);
		return rows[0];
	});

	return json(
		{
			id: hazard.id as string,
			route_id: id,
			kind: hazard.kind as string,
			lat: (hazard.lat as number | null) ?? null,
			lon: (hazard.lon as number | null) ?? null,
			note: (hazard.note as string | null) ?? null,
			confirmations: Number(hazard.confirmations) || 0,
			expires_at: (hazard.expires_at as Date).toISOString(),
			created_at: (hazard.created_at as Date).toISOString()
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
