// Server-side plan pipeline behind the `planRoute` remote command.
// Geocodes every stop in order (respecting Nominatim's 1 req/sec policy),
// routes each leg, resamples at 50 m, fetches elevation, then hands the
// sample to the shared pure scorer. Returns the full PlanPacket.

import { MODES, NOMINATIM_DELAY_MS } from '../engine/modes.js';
import { geocode, route, elevations } from './services.js';
import { resample, RESAMPLE_STEP_M } from '../util.js';
import type { LatLon } from '../util.js';
import { buildPlanPacket } from '../engine/planCore.js';
import type { PlanPacket } from '../engine/planShared.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const isValidLatLon = (c: unknown): c is [number, number] =>
	Array.isArray(c) &&
	c.length === 2 &&
	Number.isFinite(c[0]) &&
	Number.isFinite(c[1]) &&
	Math.abs(c[0]) <= 90 &&
	Math.abs(c[1]) <= 180;

export interface RemoteStop {
	value: string;
	coords: [number, number] | null;
}

export const runRemotePlan = async (
	stops: RemoteStop[],
	boardVal: string,
	modeId: string,
	country = 'za'
): Promise<PlanPacket> => {
	const selected = MODES[modeId] ?? MODES.eskate;
	const board = boardVal || selected.boards[0].value;

	const queries = stops.map((s) => s.value.trim());
	if (queries.length < 2 || queries.some((q) => !q)) {
		throw new Error('Every stop needs a place before you can plan the route.');
	}
	const t0 = performance.now();

	const coords: LatLon[] = [];
	for (let i = 0; i < queries.length; i++) {
		const exact = stops[i]?.coords;
		if (isValidLatLon(exact)) {
			coords.push([exact[0], exact[1]]);
			continue;
		}
		coords.push(await geocode(queries[i], country));
		if (i < queries.length - 1) await sleep(NOMINATIM_DELAY_MS);
	}
	const tGeo = performance.now();

	let line: LatLon[] = [];
	// Legs are independent router calls with no shared rate policy, so they
	// run concurrently (unlike Nominatim above, which stays sequential).
	// Order is preserved: legs[i] always joins coords[i] → coords[i + 1].
	const legs = await Promise.all(
		coords.slice(0, -1).map((from, i) => route(from, coords[i + 1]))
	);
	for (const leg of legs) line = line.concat(line.length ? leg.slice(1) : leg);
	if (line.length < 2) throw new Error('Routing returned no usable geometry.');
	const tRoute = performance.now();

	const pts = resample(line, RESAMPLE_STEP_M);
	const elev = await elevations(pts);
	const tElev = performance.now();

	const packet = buildPlanPacket({
		line,
		coords,
		pts,
		elev,
		boardVal: board,
		modeId: MODES[modeId] ? modeId : 'eskate',
		queries,
		source: 'planned'
	});
	// One line per plan on stdout — the perf record for the waterfall.
	// eslint-disable-next-line no-console
	console.info(
		`[runRemotePlan] stops=${queries.length} pts=${pts.length} ` +
			`geocode=${Math.round(tGeo - t0)}ms route=${Math.round(tRoute - tGeo)}ms ` +
			`elev=${Math.round(tElev - tRoute)}ms score=${Math.round(performance.now() - tElev)}ms`
	);
	return packet;
}