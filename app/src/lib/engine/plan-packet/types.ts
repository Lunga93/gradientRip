// Serializable types shared between server and client.
// Plain data only — no runes, no stores, no I/O.

export type LatLon = [number, number];

export type PlanSource = 'planned' | 'drawn' | 'recorded';

export interface Phys {
	cda: number;
	crr: number;
	eff: number;
	usable: number;
	speed: number;
	vehicleKg: number;
}

export interface Board {
	label: string;
	value: string; // "capWh|climbLimit|brakeLimit"
}

export interface Mode {
	label: string;
	tag: string;
	group: 'electric' | 'human';
	unit: string;
	human?: boolean;
	climbNote: string;
	phys: Phys;
	boards: Board[];
	brakeNote: string;
}

export interface Band {
	c: string;
	k: string;
}

export interface RouteSegment {
	a: LatLon;
	b: LatLon;
	c: string;
	k: string;
	grade: number;
}

export interface Verdict {
	level: 'fly' | 'ok' | 'caution' | 'stop';
	badge: string;
	text: string;
}

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

export interface ScoredResult {
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
}

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