// GET /api/routes/explore?lat&lon&sport — public community route discovery,
// score-ordered via routeScore() with a server-computed `fit` badge using the
// same thresholds as fitBadge(). Consumed by the Task 8 feed.
//
// NOTE: lat/lon are accepted (validated) for forward-compat but do not affect
// ordering yet — public_routes has no geo column, so proximity ranking waits
// on a PostGIS follow-up. Ordering is purely popularity × freshness.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { getPool } from '$lib/server/db.js';
import { routeScore, fitBadge } from '$lib/community/scoring.js';
import { parseSports } from '$lib/profiles/profile.js';

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export const GET: RequestHandler = async (event) => {
	const q = event.url.searchParams;
	const latRaw = q.get('lat');
	const lonRaw = q.get('lon');
	const sportRaw = q.get('sport');

	const parseCoord = (raw: string | null, min: number, max: number, name: string): number | null => {
		if (raw === null) return null;
		const n = Number(raw);
		if (!isFiniteNum(n) || n < min || n > max) throw error(400, `${name} must be in [${min}, ${max}]`);
		return n;
	};
	// Validated for forward-compat; proximity ordering waits on a PostGIS follow-up.
	parseCoord(latRaw, -90, 90, 'lat');
	parseCoord(lonRaw, -180, 180, 'lon');
	if (latRaw !== null && lonRaw === null) throw error(400, 'lon is required with lat');
	if (lonRaw !== null && latRaw === null) throw error(400, 'lat is required with lon');

	let sport: string | null = null;
	if (sportRaw !== null && sportRaw !== '') {
		if (parseSports([sportRaw]).length === 0) throw error(400, 'unknown sport');
		sport = sportRaw;
	}

	const { rows } = await getPool().query(
		`SELECT r.id, r.title, r.sport, r.line, r.stats, r.created_at,
				COALESCE(s.rides, 0)::int AS rides,
				COALESCE(s.saves, 0)::int AS saves,
				COALESCE(s.kudos, 0)::int AS kudos
		 FROM public_routes r LEFT JOIN route_stats s ON s.route_id = r.id
		 WHERE r.hidden = false ${sport ? 'AND r.sport = $1' : ''}
		 ORDER BY r.created_at DESC LIMIT 200`,
		sport ? [sport] : []
	);

	const now = Date.now();
	const routes = rows
		.map((row) => {
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
			return {
				id: row.id as string,
				title: row.title as string,
				sport: row.sport as string,
				line: row.line as [number, number][],
				created_at: (row.created_at as Date).toISOString(),
				rides,
				saves,
				kudos,
				score,
				fit
			};
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, 50);

	return json({ routes }, { headers: { 'Cache-Control': 'no-store' } });
};
