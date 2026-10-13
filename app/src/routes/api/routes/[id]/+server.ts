// GET /api/routes/[id] — single public route detail.
// Visibility mirrors the explore list (hidden = false only); hidden or missing
// 404s with the same error shape as the event-detail GET.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getPool } from '$lib/server/db.js';
import { routeScore, fitBadge } from '$lib/community/scoring.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const GET: RequestHandler = async (event) => {
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid route id');
	const { rows } = await getPool().query(
		`SELECT r.id, r.title, r.sport, r.line, r.stats, r.created_at,
				COALESCE(s.rides, 0)::int AS rides,
				COALESCE(s.saves, 0)::int AS saves,
				COALESCE(s.kudos, 0)::int AS kudos
		 FROM public_routes r LEFT JOIN route_stats s ON s.route_id = r.id
		 WHERE r.id = $1 AND r.hidden = false`,
		[id]
	);
	if (rows.length === 0) throw error(404, 'Route not found');
	const row = rows[0];
	// Open hazards only (expires_at > now()), parent-joined to the route —
	// child tables carry no independent RLS, so every hazard read goes through
	// public_routes (migration header). Anonymous callers reach here with no
	// session (no requireAuth on this path) and see open-route hazards.
	const { rows: hazardRows } = await getPool().query(
		`SELECT h.id, h.kind, h.lat, h.lon, h.note, h.confirmations, h.expires_at, h.created_at,
				u.display_name AS reporter_name
		 FROM hazards h JOIN public_routes r ON r.id = h.route_id
		 LEFT JOIN users u ON u.id = h.reporter
		 WHERE h.route_id = $1 AND r.hidden = false AND h.expires_at > now()
		 ORDER BY h.created_at DESC`,
		[id]
	);
	const now = Date.now();
	const ageDays = Math.max(0, (now - new Date(row.created_at).getTime()) / 86400000);
	const rides = Number(row.rides) || 0;
	const saves = Number(row.saves) || 0;
	const kudos = Number(row.kudos) || 0;
	const score = routeScore(rides, saves, kudos, ageDays);
	let fit: 'fly' | 'ok' | 'caution' | 'stop' | null = null;
	const st = row.stats as Record<string, unknown> | null;
	if (st && typeof st === 'object') {
		const vals = ['totalWh', 'usableWh', 'worstClimb', 'climbLimit', 'worstDescent', 'brakeLimit'].map(
			(k) => st[k]
		);
		if (vals.every(isFiniteNum)) {
			const [totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit] =
				vals as number[];
			fit = fitBadge(totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit);
		}
	}
	return json(
		{
			id: row.id as string,
			title: row.title as string,
			sport: row.sport as string,
			line: row.line as [number, number][],
			created_at: (row.created_at as Date).toISOString(),
			rides,
			saves,
			kudos,
			score,
			fit,
			hazards: hazardRows.map((h) => {
				const created = new Date(h.created_at as Date | string).getTime();
				return {
					id: h.id as string,
					kind: h.kind as string,
					lat: (h.lat as number | null) ?? null,
					lon: (h.lon as number | null) ?? null,
					note: (h.note as string | null) ?? null,
					confirmations: Number(h.confirmations) || 0,
					reporter_name: (h.reporter_name as string | null) ?? null,
					created_at: new Date(h.created_at as Date | string).toISOString(),
					expires_at: new Date(h.expires_at as Date | string).toISOString(),
					age_days: Math.max(0, (now - created) / 86400000)
				};
			})
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
