// Pure scoring builder shared by the server plan action and the client
// draw/record scorers — identical physics, one implementation. Depends only
// on the pure modules (modes/scoring/util) so it runs on either side.

import { MODES, RIDER_KIT_KG } from './modes.js';
import { haversine, cumulative } from './geometry.js';
import type { LatLon } from './geometry.js';
import { segWh, routeSegments, verdictFor, smooth3 } from './scoring.js';
import type { PlanPacket, PlanSource } from './planShared.js';

export interface ScoreInput {
	line: LatLon[];
	coords: LatLon[];
	pts: LatLon[];
	elev: number[];
	boardVal: string;
	modeId: string;
	queries: string[];
	source: PlanSource;
}

export const buildPlanPacket = (input: ScoreInput): PlanPacket => {
	const { line, coords, pts, elev: rawElev, boardVal, modeId, queries, source } = input;
	if (!Array.isArray(pts) || pts.length < 2) throw new Error('Need at least 2 points to score.');
	if (!Array.isArray(rawElev) || rawElev.length !== pts.length)
		throw new Error('Elevation sample count does not match route points.');
	const elev = smooth3(rawElev);
	const mode = MODES[modeId] ?? MODES.eskate;
	const modeIdNorm = MODES[modeId] ? modeId : 'eskate';
	const phys = mode.phys;
	const parts = boardVal.split('|').map(Number);
	let [cap, climbLimit, brakeLimit] = parts;
	if (!Number.isFinite(cap) || !Number.isFinite(climbLimit) || !Number.isFinite(brakeLimit)) {
		[cap, climbLimit, brakeLimit] = mode.boards[0].value.split('|').map(Number);
	}
	const usableWh = cap * phys.usable;
	const mass = RIDER_KIT_KG + phys.vehicleKg;

	const cum: number[] = [0];
	for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));

	let totalWh = 0;
	let totalClimb = 0;
	for (let i = 1; i < pts.length; i++) {
		const d = cum[i] - cum[i - 1];
		const rise = elev[i] - elev[i - 1];
		const grade = rise / Math.max(1, d);
		totalWh += segWh(d, grade, mass, undefined, phys);
		if (rise > 0) totalClimb += rise;
	}

	const lineCum = cumulative(line);
	const segs = routeSegments(line, lineCum, pts, elev, cum);
	const verdict = verdictFor(segs, totalWh, usableWh, climbLimit, brakeLimit, mode);

	return {
		verdict,
		pts,
		elev,
		cum,
		totalWh,
		totalClimb,
		usableWh,
		modeId: modeIdNorm,
		segs,
		line,
		coords,
		queries,
		boardVal,
		climbLimit,
		brakeLimit,
		totalKm: cum[cum.length - 1] / 1000 || 0,
		source
	};
}