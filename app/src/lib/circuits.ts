import { haversine } from './engine/route-geometry/haversine.js';
import { cumulative } from './engine/route-geometry/cumulative.js';
import { routeSegments } from './engine/route-segments/segment.js';
import { segWh } from './engine/energy-physics/calculate.js';
import { totalMass } from './engine/energy-physics/mass.js';
import { decide } from './engine/verdict/decide.js';
import { MODES } from './engine/transport-modes/index.js';
import type { LatLon, Mode, RouteSegment, Verdict } from './engine/plan-packet/types.js';
import { publicStartDistanceM } from './community/privacy.js';

// Distance chips offered by HomeCircuitBar.
export const CIRCUIT_KMS = [5, 8, 12] as const;

export type HomePoint = LatLon | { lat: number; lon: number };

const toTuple = (home: HomePoint): LatLon =>
	Array.isArray(home) ? home : [home.lat, home.lon];

export const offsetStart = (
	line: [number, number][],
	home: [number, number],
	offsetM: number
): [number, number][] => {
	if (line.length === 0) return [];
	// Walk the line until `offsetM` metres of path have passed, then cut the
	// segment there: the public line starts exactly at the offset distance
	// instead of jumping to the next vertex (which could overshoot by a full
	// leg, or collapse a short line to a single point).
	let acc = 0;
	for (let i = 1; i < line.length; i++) {
		const d = haversine(line[i - 1], line[i]);
		if (acc + d >= offsetM) {
			const t = d === 0 ? 0 : (offsetM - acc) / d;
			const cut: [number, number] = [
				line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t,
				line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t
			];
			return [cut, ...line.slice(i)];
		}
		acc += d;
	}
	return [line[line.length - 1]];
};

// A home circuit scored the same way the planner scores: flat-loop geometry
// for the km target, public start pushed `publicStartDistanceM()` away from
// the exact home, energy via segWh, verdict via decide().
//
// Returns the same ScoredResult shape `domain.applyResult()` expects
// (verdict, pts, elev, cum, totalWh, totalClimb, usableWh, mode, segs, line,
// coords, boardVal, climbLimit, brakeLimit) — declared structurally here so
// this pure module never imports the rune-based domain store.
export interface HomeCircuit {
	verdict: Verdict;
	pts: LatLon[];
	elev: number[];
	cum: number[];
	totalWh: number;
	totalClimb: number;
	usableWh: number;
	mode: Mode;
	segs: RouteSegment[];
	line: LatLon[];
	coords: LatLon[];
	boardVal: string;
	climbLimit: number;
	brakeLimit: number;
}

export const buildHomeCircuit = (
	home: HomePoint,
	kmTarget: number,
	boardVal: string,
	modeId = 'eskate'
): HomeCircuit => {
	const center = toTuple(home);
	const mode = MODES[modeId] ?? MODES.eskate;

	// Circular loop through home whose circumference matches the km target:
	// the centre sits one radius due east of home, so the loop starts and
	// ends at the front door and `offsetStart` below measures from home.
	const radiusM = (kmTarget * 1000) / (2 * Math.PI);
	const cosLat = Math.cos((center[0] * Math.PI) / 180);
	const middle: LatLon = [center[0], center[1] + radiusM / (111320 * cosLat)];
	const N = 64;
	const loop: LatLon[] = [];
	for (let i = 0; i <= N; i++) {
		const theta = Math.PI + (2 * Math.PI * i) / N;
		loop.push([
			middle[0] + (radiusM * Math.cos(theta)) / 111320,
			middle[1] + (radiusM * Math.sin(theta)) / (111320 * cosLat)
		]);
	}

	// Privacy: the published line starts away from the exact home address.
	const line = offsetStart(loop, center, publicStartDistanceM());

	// Flat loop — no elevation survey, so every leg is grade 0.
	const pts = line;
	const elev = line.map(() => 0);
	const cum = cumulative(line);

	const parts = boardVal.split('|').map(Number);
	let [cap, climbLimit, brakeLimit] = parts;
	if (!Number.isFinite(cap) || !Number.isFinite(climbLimit) || !Number.isFinite(brakeLimit)) {
		[cap, climbLimit, brakeLimit] = mode.boards[0].value.split('|').map(Number);
	}
	const usableWh = cap * mode.phys.usable;
	const mass = totalMass(mode);

	let totalWh = 0;
	for (let i = 1; i < pts.length; i++) {
		const d = cum[i] - cum[i - 1];
		totalWh += segWh(d, 0, mass, undefined, mode.phys);
	}

	const segs = routeSegments(line, cumulative(line), pts, elev, cum);
	const verdict = decide(segs, totalWh, usableWh, climbLimit, brakeLimit, mode);

	return {
		verdict,
		pts,
		elev,
		cum,
		totalWh,
		totalClimb: 0,
		usableWh,
		mode,
		segs,
		line,
		coords: [line[0], line[line.length - 1]],
		boardVal,
		climbLimit,
		brakeLimit
	};
};
