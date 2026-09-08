// Central app state — Svelte 5 runes module (.svelte.ts).
// Owns everything the legacy app kept as module-level `let`s; components
// read it directly and mutate through the exported action functions.

import { MODES, RIDER_KIT_KG } from '../modes.js';
import type { Mode } from '../modes.js';
import {
	loadPresets,
	savePresets,
	loadTrips,
	saveTrips,
	loadMode,
	saveMode,
	loadCollapsed,
	saveCollapsed,
	loadLegalDismissed,
	setLegalDismissed,
	clearLegalDismissed,
	loadJSON,
	TRANSPORT_KEY,
	TRIPS_MAX
} from '../storage.js';
import type { Preset, Trip } from '../storage.js';
import type { LatLon } from '../util.js';
import type { RouteSegment, Verdict } from '../scoring.js';

export interface Stop {
	value: string;
	coords: LatLon | null;
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

const stopFrom = (s: Stop): Stop => ({ value: s.value, coords: s.coords });

function loadModeId(): string {
	const saved = loadMode();
	if (saved && MODES[saved]) return saved;
	return 'eskate';
}

// --- exported reactive state (single instance, class fields are $state) ---
class AppState {
	onboardSeen = $state(!!loadJSON<string | null>(TRANSPORT_KEY, null));
	modeId = $state(loadModeId());
	boardVal = $state('');
	stops = $state<Stop[]>([{ value: '', coords: null }, { value: '', coords: null }]);
	activeStopIndex = $state(0);
	results = $state<ScoredResult | null>(null);
	planning = $state(false);
	statusMsg = $state('');
	statusErr = $state(false);
	currentRoute = $state<{ line: LatLon[]; lineCum: number[] } | null>(null);

	// live tracking
	trackingActive = $state(false);
	trackingStats = $state<{ pct: number; remainingKm: string; acc: string } | null>(null);
	trackingMsg = $state('');
	trackingWarn = $state(false);
	recenterVisible = $state(false);
	following = $state(true);

	// draw / record modes
	drawMode = $state(false);
	drawPoints = $state<LatLon[]>([]);
	recordMode = $state(false);
	recordPoints = $state<LatLon[]>([]);
	recordKm = $state(0);

	// autocomplete
	acIdx = $state<number | null>(null);
	acResults = $state<{ label: string; lat: number; lon: number }[]>([]);
	acActive = $state(-1);

	// UI chrome
	netOnline = $state(true);
	sheetOpen = $state(false);
	tripsCollapsed = $state(loadCollapsed('trips'));
	legalDismissed = $state(loadLegalDismissed());

	// data lists
	presets = $state<Preset[]>(typeof localStorage !== 'undefined' ? loadPresets() : []);
	trips = $state<Trip[]>(typeof localStorage !== 'undefined' ? loadTrips() : []);

	// --- derived ---
	mode = $derived<Mode>(MODES[this.modeId] ?? MODES.eskate);
	boards = $derived(this.mode.boards);
	online = $derived(this.netOnline);
	offlineHint = $derived(
		this.netOnline
			? ''
			: "You're offline. Planning a new route needs a connection (geocoding, roads and elevation are live lookups) — but any saved trip below still opens instantly, fully offline."
	);
	statusBusy = $derived(!!this.statusMsg && !this.statusErr);
	hasResults = $derived(this.results !== null);
	planControlsHidden = $derived(this.trackingActive);
	isMobile = $state(false);

	// physics helpers derived from current selection
	phys = $derived(this.mode.phys);
	mass = $derived(RIDER_KIT_KG + this.phys.vehicleKg);
	usableWh = $derived.by(() => {
		const [cap] = (this.boardVal || this.boards[0]?.value || '0|0|0').split('|').map(Number);
		return cap * this.phys.usable;
	});

	// --- actions ---
	selectMode(id: string) {
		if (!MODES[id]) return;
		this.modeId = id;
		saveMode(id);
		this.boardVal = MODES[id].boards[0].value;
	}

	toggleTripsCollapsed() {
		this.tripsCollapsed = !this.tripsCollapsed;
		saveCollapsed('trips', this.tripsCollapsed);
	}

	dismissLegal() {
		this.legalDismissed = true;
		setLegalDismissed();
	}

	restoreLegal() {
		this.legalDismissed = false;
		clearLegalDismissed();
	}

	setSheet(open: boolean) {
		this.sheetOpen = open;
	}

	setStatus(msg: string, isErr = false) {
		const busy = !!(msg && !isErr);
		this.statusMsg = busy ? msg.replace(/…+$/, '') : msg;
		this.statusErr = isErr;
	}

	addStop() {
		this.stops.splice(this.stops.length - 1, 0, { value: '', coords: null });
	}

	removeStop(idx: number) {
		if (idx <= 0 || idx >= this.stops.length - 1) return; // endpoints protected
		this.stops.splice(idx, 1);
	}

	reverseStops() {
		this.stops.reverse();
	}

	setStopValue(idx: number, value: string) {
		const s = this.stops[idx];
		if (!s) return;
		s.value = value;
		s.coords = null; // typing invalidates any exact fix
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
			this.setStatus('Type a place into that field before saving it.', true);
			return;
		}
		const suggested = val.length > 28 ? val.slice(0, 28) + '…' : val;
		const label = window.prompt('Save this place as:', suggested);
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
	}

	deletePreset(id: number) {
		this.presets = this.presets.filter((p) => p.id !== id);
		savePresets($state.snapshot(this.presets));
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
	}

	deleteTrip(idx: number) {
		this.trips = this.trips.filter((_, i) => i !== idx);
		saveTrips($state.snapshot(this.trips));
	}

	applyResult(r: ScoredResult) {
		this.results = r;
		// A fresh plan or a loaded trip both replace whatever route live tracking
		// was following — stop any in-progress session before swapping the data
		// out from under it.
		stopTracking();
		this.currentRoute = { line: r.line, lineCum: cumulativeOf(r.line) };
	}
}

// import cycle avoidance: set here rather than importing tracker into state
let cumulativeOf: (line: LatLon[]) => number[] = (line) => {
	const cum = [0];
	for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + 0);
	return cum;
};
export function registerCumulative(fn: (line: LatLon[]) => number[]) {
	cumulativeOf = fn;
}

export const app = new AppState();

// stopTracking lives in tracker.ts; to avoid a circular import the state
// class calls it through this late-bound hook, registered by tracker.ts at
// module load.
let stopTrackingImpl: () => void = () => {};
export function registerStopTracking(fn: () => void) {
	stopTrackingImpl = fn;
}
export function stopTracking() {
	stopTrackingImpl();
}

export function cloneStops(stops: Stop[]): Stop[] {
	return stops.map(stopFrom);
}
