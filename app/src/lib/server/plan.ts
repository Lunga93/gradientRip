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

	let line: LatLon[] = [];
	for (let i = 0; i < coords.length - 1; i++) {
		const leg = await route(coords[i], coords[i + 1]);
		line = line.concat(line.length ? leg.slice(1) : leg);
	}
	if (line.length < 2) throw new Error('Routing returned no usable geometry.');

	const pts = resample(line, RESAMPLE_STEP_M);
	const elev = await elevations(pts);

	return buildPlanPacket({
		line,
		coords,
		pts,
		elev,
		boardVal: board,
		modeId: MODES[modeId] ? modeId : 'eskate',
		queries,
		source: 'planned'
	});
}