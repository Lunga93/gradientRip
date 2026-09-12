// GPS/draw/record/autocomplete session state — everything the tracker,
// the draw/record modes and the autocomplete dropdown mutate while active.
// Ride data lives in domain, chrome in ui; the planner orchestrates all three.

import type { LatLon } from '../util.js';

class SessionState {
	planning = $state(false);

	// live tracking
	trackingActive = $state(false);
	trackingPaused = $state(false);
	trackingStartedAt = $state<number | null>(null);
	trackingStats = $state<{ pct: number; remainingKm: string; acc: string; speedKmh: string } | null>(
		null
	);
	trackingMsg = $state('');
	trackingWarn = $state(false);
	arrivalShown = $state(false);
	recenterVisible = $state(false);
	following = $state(true);

	// draw / record modes
	drawMode = $state(false);
	drawPoints = $state<LatLon[]>([]);
	drawLegs = $state<LatLon[][]>([]);
	recordMode = $state(false);
	recordPoints = $state<LatLon[]>([]);
	recordKm = $state(0);
	recordStartedAt = $state<number | null>(null);
	recordSpeedKmh = $state<number | null>(null);
	recordAcc = $state<number | null>(null);

	// autocomplete
	acIdx = $state<number | null>(null);
	acResults = $state<{ label: string; lat: number; lon: number }[]>([]);
	acActive = $state(-1);

	// --- derived ---
	planControlsHidden = $derived(this.trackingActive);
}

export const session = new SessionState();
