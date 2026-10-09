
import type { LatLon } from '../util.js';

class SessionState {
	planning = $state(false);

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

	drawMode = $state(false);
	drawPoints = $state<LatLon[]>([]);
	drawLegs = $state<LatLon[][]>([]);
	recordMode = $state(false);
	recordPoints = $state<LatLon[]>([]);
	recordKm = $state(0);
	recordStartedAt = $state<number | null>(null);
	recordSpeedKmh = $state<number | null>(null);
	recordAcc = $state<number | null>(null);

	acIdx = $state<number | null>(null);
	acResults = $state<{ label: string; lat: number; lon: number }[]>([]);
	acActive = $state(-1);

	planControlsHidden = $derived(this.trackingActive);
}

export const session = new SessionState();
