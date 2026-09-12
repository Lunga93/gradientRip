// Domain state — the ride itself: stops, results, presets, trips, mode/board.
// No UI chrome, no GPS session. Status feedback goes through ui.setStatus.

import { MODES } from '../engine/index.js';
import type { Mode } from '../engine/index.js';
import {
	loadPresets,
	savePresets,
	loadTrips,
	saveTrips,
	loadMode,
	saveMode,
	loadBoard,
	saveBoard,
	TRIPS_MAX
} from '../storage.js';
import type { Preset, Trip } from '../storage.js';
import { scheduleBackup } from '../sync.js';
import type { LatLon } from '../util.js';
import { cumulative } from '../util.js';
import type { RouteSegment, Verdict } from '../engine/index.js';
import { ui } from './ui.svelte.js';

export interface Stop {
	id: number;
	value: string;
	coords: LatLon | null;
}

let stopSeq = 3;
export const nextStopId = (): number => stopSeq++;

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
	boardVal: string;
	climbLimit: number;
	brakeLimit: number;
}

// Board values are "capWh|climbPct|brakePct" — either a shipped preset or a
// user-tuned custom triple from onboarding. Ranges keep scoring sane
// (a zero cap would divide by zero in battery math downstream).
export const BOARD_RANGES = {
	cap: [50, 5000],
	climb: [1, 45],
	brake: [1, 30]
} as const;

export const parseBoardVal = (v: unknown): [number, number, number] | null => {
	if (typeof v !== 'string') return null;
	const parts = v.split('|').map(Number);
	if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
	const [cap, climb, brake] = parts as [number, number, number];
	if (
		cap < BOARD_RANGES.cap[0] ||
		cap > BOARD_RANGES.cap[1] ||
		climb < BOARD_RANGES.climb[0] ||
		climb > BOARD_RANGES.climb[1] ||
		brake < BOARD_RANGES.brake[0] ||
		brake > BOARD_RANGES.brake[1]
	) {
		return null;
	}
	return [cap, climb, brake];
};

export const isPresetBoard = (modeId: string, value: string): boolean =>
	(MODES[modeId]?.boards ?? []).some((b) => b.value === value);

const loadModeId = (): string => {
	const saved = loadMode();
	if (saved && MODES[saved]) return saved;
	return 'eskate';
};

// Restore the last picked board: a shipped preset, or a valid custom triple
// tuned in onboarding (never a stale value from another mode's presets,
// and never a malformed string that would poison scoring math).
const initialBoardVal = (modeId: string): string => {
	const boards = MODES[modeId].boards;
	const saved = loadBoard();
	if (saved && (boards.some((b) => b.value === saved) || parseBoardVal(saved))) return saved;
	return boards[0].value;
};

class DomainState {
	// The legacy app stored the picked mode as a raw string in
	// TRANSPORT_KEY and treated its presence as "onboarding done" — do the
	// same so old users carry over and the flag survives reloads.
	onboardSeen = $state(!!loadMode());
	modeId = $state(loadModeId());
	boardVal = $state(initialBoardVal(this.modeId));
	stops = $state<Stop[]>([
		{ id: 1, value: '', coords: null },
		{ id: 2, value: '', coords: null }
	]);
	activeStopIndex = $state(0);
	results = $state<ScoredResult | null>(null);
	currentRoute = $state<{ line: LatLon[]; lineCum: number[] } | null>(null);

	// data lists
	presets = $state<Preset[]>(typeof localStorage !== 'undefined' ? loadPresets() : []);
	trips = $state<Trip[]>(typeof localStorage !== 'undefined' ? loadTrips() : []);

	// --- derived ---
	mode = $derived<Mode>(MODES[this.modeId] ?? MODES.eskate);
	boards = $derived(this.mode.boards);

	// --- actions ---
	selectMode(id: string) {
		if (!MODES[id]) return;
		this.modeId = id;
		saveMode(id);
		this.boardVal = MODES[id].boards[0].value;
		saveBoard(this.boardVal);
	}

	selectBoard(value: string) {
		if (!this.boards.some((b) => b.value === value)) return;
		this.boardVal = value;
		saveBoard(value);
	}

	// User-tuned triple from onboarding — validated, then persisted like a preset.
	// Returns false (and changes nothing) when out of range.
	setCustomBoard(cap: number, climb: number, brake: number): boolean {
		const value = `${Math.round(cap)}|${Math.round(climb)}|${Math.round(brake)}`;
		if (!parseBoardVal(value)) return false;
		this.boardVal = value;
		saveBoard(value);
		return true;
	}

	completeOnboarding() {
		this.onboardSeen = true;
		saveMode(this.modeId); // raw string in TRANSPORT_KEY, legacy-compatible
	}

	addStop() {
		this.stops.splice(this.stops.length - 1, 0, { id: nextStopId(), value: '', coords: null });
	}

	removeStop(idx: number) {
		if (idx <= 0 || idx >= this.stops.length - 1) return; // endpoints protected
		this.stops.splice(idx, 1);
	}

	reverseStops() {
		this.stops.reverse();
	}

	setStopValue(idx: number, value: string, keepCoords = false) {
		const s = this.stops[idx];
		if (!s) return;
		s.value = value;
		// Typing invalidates any exact fix; programmatic selections
		// (autocomplete, geolocation) pass keepCoords to preserve it.
		if (!keepCoords) s.coords = null;
	}

	setStopCoords(idx: number, coords: LatLon) {
		const s = this.stops[idx];
		if (!s) return;
		s.coords = coords;
	}

	focusStop(idx: number) {
		this.activeStopIndex = idx;
	}

	saveStopAsPreset(idx: number) {
		const val = (this.stops[idx]?.value || '').trim();
		if (!val) {
			ui.setStatus('Type a place into that field before saving it.', true);
			return;
		}
		const suggested = val.length > 28 ? val.slice(0, 28) + '…' : val;
		const label = presetNamer('Save this place as:', suggested);
		if (!label) return;
		// Carry the exact fix along if this stop was set via geolocation, so
		// re-selecting the saved place later skips fuzzy text geocoding too.
		this.presets.push({
			id: Date.now() + Math.random(),
			label: label.trim(),
			query: val,
			coords: this.stops[idx].coords || null
		});
		savePresets($state.snapshot(this.presets));
		scheduleBackup($state.snapshot(this.trips), $state.snapshot(this.presets));
	}

	deletePreset(id: number) {
		this.presets = this.presets.filter((p) => p.id !== id);
		savePresets($state.snapshot(this.presets));
		scheduleBackup($state.snapshot(this.trips), $state.snapshot(this.presets));
	}

	applyPresetToActiveStop(p: Preset) {
		const s = this.stops[this.activeStopIndex];
		if (!s) return;
		s.value = p.query;
		s.coords = p.coords || null;
	}

	addTrip(trip: Trip) {
		this.trips.unshift(trip);
		this.trips = this.trips.slice(0, TRIPS_MAX);
		saveTrips($state.snapshot(this.trips));
		scheduleBackup($state.snapshot(this.trips), $state.snapshot(this.presets));
	}

	deleteTrip(idx: number) {
		this.trips = this.trips.filter((_, i) => i !== idx);
		saveTrips($state.snapshot(this.trips));
		scheduleBackup($state.snapshot(this.trips), $state.snapshot(this.presets));
	}

	// Pure assignment only — lifecycle side effects (stopping live tracking)
	// belong to the callers in planner.svelte.ts, which own the session.
	applyResult(r: ScoredResult) {
		this.results = r;
		this.currentRoute = { line: r.line, lineCum: cumulative(r.line) };
	}
}

export const domain = new DomainState();

// Prompt hook for preset naming — window.prompt by default so tests can inject.
type PresetNamer = (message: string, defaultName: string) => string | null;
let presetNamer: PresetNamer = (message, defaultName) =>
	typeof window !== 'undefined' && typeof window.prompt === 'function'
		? window.prompt(message, defaultName)
		: defaultName;
export const setPresetNamer = (fn: PresetNamer): void => {
	presetNamer = fn;
};
