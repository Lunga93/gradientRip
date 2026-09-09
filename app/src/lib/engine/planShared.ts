// Serialisable shape the server hands back after a plan, and both the
// server pipeline (src/lib/server/plan.ts) and the client scorer
// (src/lib/engine/planCore.ts) agree on. Plain data only — no runes, no stores.

import type { Verdict, RouteSegment } from './scoring.js';
import type { LatLon } from './geometry.js';

export type PlanSource = 'planned' | 'drawn' | 'recorded';

export interface PlanPacket {
	verdict: Verdict;
	pts: LatLon[];
	elev: number[];
	cum: number[];
	totalWh: number;
	totalClimb: number;
	usableWh: number;
	modeId: string;
	segs: RouteSegment[];
	line: LatLon[];
	coords: LatLon[];
	queries: string[];
	boardVal: string;
	climbLimit: number;
	brakeLimit: number;
	totalKm: number;
	source: PlanSource;
}