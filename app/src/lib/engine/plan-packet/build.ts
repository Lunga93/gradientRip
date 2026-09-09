import { MODES } from '../transport-modes/index.js';
import { totalMass } from '../energy-physics/mass.js';
import { segWh } from '../energy-physics/calculate.js';
import { haversine } from '../route-geometry/haversine.js';
import { cumulative } from '../route-geometry/cumulative.js';
import { routeSegments } from '../route-segments/segment.js';
import { decide } from '../verdict/decide.js';
import { smooth3 } from '../elevation-profile/smooth.js';
import type { PlanPacket, ScoreInput } from './types.js';

/** Build the serializable PlanPacket from raw route + elevation data. */
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
	const mass = totalMass(mode);

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
	const verdict = decide(segs, totalWh, usableWh, climbLimit, brakeLimit, mode);

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
};