import { nearestOnLine, haversine, geoErrorMessage } from './util.js';
import type { LatLon } from './util.js';
import { domain } from './state/domain.svelte.js';
import { ui } from './state/ui.svelte.js';
import { session } from './state/session.svelte.js';
import { social } from './social.svelte.js';
import { publishPosition, stopPublishing } from './live.js';
import { getMap, ensureLeaflet } from './mapController.svelte.js';
import {
	redrawDrawLayer, clearDrawLayer, setDrawCursor,
	redrawRecordLayer, clearRecordLayer, ensureMap,
	updateTrackMarker, clearTrackMarker, updateRecordMarker,
	setRouteProgress, clearRouteProgress,
	showHillBadge, clearHillBadge,
	showArrivalBadge, clearArrivalBadge
} from './mapController.svelte.js';
import { scoreAndSaveCustomRoute, askRouteName, snapDrawnLeg } from './planner.svelte.js';

/* ---------- tracking ---------- */

interface Tracking {
	watchId: number | null;
	hasFix: boolean;
	lastLatLng: LatLon | null;
}
const tracking: Tracking = { watchId: null, hasFix: false, lastLatLng: null };

const setTrackMsg = (msg: string, warn: boolean): void => {
	session.trackingMsg = msg;
	session.trackingWarn = warn;
};

// Latest own fix for friend-distance display (tracking fix wins, else record tail).
export const getOwnFix = (): LatLon | null =>
	tracking.lastLatLng ?? session.recordPoints[session.recordPoints.length - 1] ?? null;

// Friends see me while riding or recording — publish the fix (throttled
// inside publishPosition, no-op when signed out). Clearing happens when
// neither mode is active anymore so mode switches don't flap the row.
const shareFix = (latlng: LatLon, speed: number | null, accuracy: number): void => {
	if (!social.signedIn) return;
	void publishPosition({ lat: latlng[0], lon: latlng[1], speed, heading: null, accuracy });
};

const maybeStopSharing = (): void => {
	if (!session.trackingActive && !session.recordMode) void stopPublishing();
};

export const startTracking = (): void => {
	if (session.trackingActive) return;
	if (!domain.currentRoute) return;
	if (!navigator.geolocation) { setTrackMsg('Geolocation is not available in this browser.', true); return; }
	if (session.drawMode) exitDrawMode();
	if (session.recordMode) exitRecordMode();
	session.following = true;
	session.trackingActive = true;
	session.trackingPaused = false;
	session.trackingStartedAt = Date.now();
	session.trackingStats = null;
	session.arrivalShown = false;
	setTrackMsg('Starting GPS tracking — this uses more battery than normal use.', false);
	tracking.watchId = navigator.geolocation.watchPosition(onTrackUpdate, onTrackError, {
		enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
	});
	setRouteProgress(0);
};

export const stopTracking = (): void => {
	if (!session.trackingActive) return;
	if (tracking.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(tracking.watchId);
	tracking.watchId = null;
	session.following = true;
	session.trackingActive = false;
	session.trackingPaused = false;
	session.trackingStartedAt = null;
	session.trackingStats = null;
	session.recenterVisible = false;
	session.arrivalShown = false;
	tracking.lastLatLng = null;
	tracking.hasFix = false;
	clearTrackMarker();
	clearRouteProgress();
	clearHillBadge();
	clearArrivalBadge();
	hillFor = null;
	maybeStopSharing();
	setTrackMsg('', false);
};

export const pauseTracking = (): void => {
	if (!session.trackingActive || session.trackingPaused) return;
	if (tracking.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(tracking.watchId);
	tracking.watchId = null;
	session.trackingPaused = true;
	setTrackMsg('Paused — GPS idle. Resume to keep following the route.', false);
};

export const resumeTracking = (): void => {
	if (!session.trackingActive || !session.trackingPaused) return;
	session.trackingPaused = false;
	setTrackMsg('', false);
	tracking.watchId = navigator.geolocation.watchPosition(onTrackUpdate, onTrackError, {
		enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
	});
};

export const finishRide = (): void => {
	stopTracking();
	ui.setStatus('Ride finished — the route stays in your Ride tab for replay.');
};

const onTrackError = (err: GeolocationPositionError): void => {
	if (!tracking.hasFix) stopTracking(); // no first fix yet → revert planControls
	setTrackMsg(geoErrorMessage(err), true);
};

const onTrackUpdate = async (pos: GeolocationPosition): Promise<void> => {
	if (!domain.currentRoute) return;
	const L = await ensureLeaflet();
	const m = getMap(); if (!m) return;
	const { latitude, longitude, accuracy, speed } = pos.coords;
	const latlng: LatLon = [latitude, longitude];
	tracking.lastLatLng = latlng;
	tracking.hasFix = true;
	updateTrackMarker(latlng, accuracy);
	shareFix(latlng, speed != null && speed >= 0 ? speed : null, accuracy);

	const { distAlong, offRoute } = nearestOnLine(latlng, domain.currentRoute.line, domain.currentRoute.lineCum);
	const totalDist = domain.currentRoute.lineCum[domain.currentRoute.lineCum.length - 1] || 1;
	const pct = Math.min(100, Math.max(0, (distAlong / totalDist) * 100));
	session.trackingStats = {
		pct: Math.round(pct),
		remainingKm: ((Math.max(0, totalDist - distAlong)) / 1000).toFixed(1) + ' km',
		acc: `±${Math.round(accuracy)} m`,
		speedKmh: speed != null && speed >= 0 ? (speed * 3.6).toFixed(0) : '—'
	};
	setRouteProgress(distAlong);
	updateHillBadge(distAlong);
	if (session.following) {
		if (offRoute > 300) m.fitBounds(L.latLngBounds([...domain.currentRoute.line, latlng]), { padding: [40, 40] });
		else m.setView(latlng, Math.max(m.getZoom(), 16));
	}
	if (offRoute > 50) {
		setTrackMsg(`${Math.round(offRoute)} m from the planned route.`, true);
	} else if (session.arrivalShown) {
		setTrackMsg('You’re here — ride complete. Tap FINISH to wrap up.', false);
	} else if (pct >= 99.5) {
		session.arrivalShown = true;
		const dest = domain.currentRoute.line[domain.currentRoute.line.length - 1];
		showArrivalBadge(dest);
		setTrackMsg('You’re here — ride complete. Tap FINISH to wrap up.', false);
	} else {
		setTrackMsg('', false);
	}
};

// Scan the scored segments ahead of the rider for the worst descent in the
// next ~600 m and pin a floating warning on the map when it bites. Segment
// spacing differs between planned and loaded routes, so distances are
// re-derived from the segment endpoints and cached per result.
let hillFor: unknown = null;
let hillCum: number[] = [];

const updateHillBadge = (distAlong: number): void => {
	const res = domain.results;
	if (!res || !res.segs.length) {
		clearHillBadge();
		return;
	}
	if (hillFor !== res) {
		hillFor = res;
		hillCum = [0];
		for (const s of res.segs) hillCum.push(hillCum[hillCum.length - 1] + haversine(s.a, s.b));
	}
	const brakeParts = (domain.boardVal || '').split('|').map(Number);
	const brakeLimit = Number.isFinite(brakeParts[2]) ? brakeParts[2] : 12;
	let worst = 0;
	let worstAt = -1;
	for (let j = 0; j < res.segs.length; j++) {
		const c = hillCum[j] ?? 0;
		if (c < distAlong + 40 || c > distAlong + 600) continue;
		if (res.segs[j].grade < worst) {
			worst = res.segs[j].grade;
			worstAt = j;
		}
	}
	if (worstAt < 0 || worst > -8) {
		clearHillBadge();
		return;
	}
	const seg = res.segs[worstAt];
	const mid: LatLon = [(seg.a[0] + seg.b[0]) / 2, (seg.a[1] + seg.b[1]) / 2];
	showHillBadge(mid, worst, Math.max(0, (hillCum[worstAt] ?? 0) - distAlong), Math.abs(worst) >= brakeLimit);
};

export const recenter = (): void => {
	session.following = true;
	session.recenterVisible = false;
	if (tracking.lastLatLng) { const m = getMap(); if (m) m.setView(tracking.lastLatLng, Math.max(m.getZoom(), 16)); }
};

/* ---------- draw mode ---------- */

export const addDrawPoint = (latlng: LatLon): void => {
	const len = session.drawPoints.length;
	session.drawPoints.push(latlng);
	if (len > 0) {
		const prev = session.drawPoints[len - 1];
		const legIdx = len - 1;
		session.drawLegs.push([prev, latlng]);
		redrawDrawLayer();
		snapDrawnLeg(prev, latlng)
			.then((res) => {
				if (!session.drawMode) return;
				if (session.drawPoints[legIdx] === prev && session.drawPoints[legIdx + 1] === latlng) {
					session.drawLegs[legIdx] = res.leg;
					redrawDrawLayer();
				}
			})
			.catch(() => {
				// keep straight fallback
			});
	} else {
		redrawDrawLayer();
	}
};

export const getDrawnPath = (): LatLon[] => {
	if (session.drawPoints.length === 0) return [];
	if (session.drawPoints.length === 1) return [session.drawPoints[0]];
	const out: LatLon[] = [session.drawPoints[0]];
	for (let i = 0; i < session.drawPoints.length - 1; i++) {
		const leg = session.drawLegs[i] || [session.drawPoints[i], session.drawPoints[i + 1]];
		if (leg.length > 1) {
			out.push(...leg.slice(1));
		}
	}
	return out;
};

export const enterDrawMode = (): void => {
	if (session.trackingActive) stopTracking();
	if (session.recordMode) exitRecordMode();
	session.drawMode = true;
	session.drawPoints = [];
	session.drawLegs = [];
	setDrawCursor(true);
	redrawDrawLayer();
	ui.setStatus('Tap the map to trace your route, then hit Finish.');
	ui.panelVisible = false; // hide panel for maximal map space
};

export const exitDrawMode = (): void => {
	session.drawMode = false;
	setDrawCursor(false);
	clearDrawLayer();
	session.drawPoints = [];
	session.drawLegs = [];
	ui.panelVisible = true; // restore panel
};

export const undoDrawPoint = (): void => {
	if (session.drawPoints.length === 0) return;
	session.drawPoints.pop();
	if (session.drawLegs.length >= session.drawPoints.length) {
		session.drawLegs.pop();
	}
	redrawDrawLayer();
};

export const finishDrawing = async (): Promise<void> => {
	if (session.drawPoints.length < 2) {
		ui.setStatus('Add at least 2 points before finishing.', true);
		return;
	}
	const name = askRouteName('Name this route:', 'Custom shortcut');
	if (!name) return;
	const line = getDrawnPath();
	exitDrawMode();
	await scoreAndSaveCustomRoute(line, name, 'drawn');
};

/* ---------- record mode ---------- */

let recordWatchId: number | null = null;

export const enterRecordMode = (): void => {
	if (!navigator.geolocation) { ui.setStatus('Geolocation is not available in this browser.', true); return; }
	if (session.trackingActive) stopTracking();
	if (session.drawMode) exitDrawMode();
	session.recordMode = true; session.recordPoints = []; session.recordKm = 0;
	session.recordStartedAt = Date.now(); session.recordSpeedKmh = null; session.recordAcc = null;
	ui.setStatus('Recording your live path — move to trace the route, then hit Finish.');
	recordWatchId = navigator.geolocation.watchPosition(onRecordUpdate, onRecordError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
	ui.panelVisible = false; // hide panel for maximal map space
};

export const exitRecordMode = (): void => {
	session.recordMode = false;
	if (recordWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(recordWatchId);
	recordWatchId = null; clearRecordLayer(); session.recordPoints = []; session.recordKm = 0;
	session.recordStartedAt = null; session.recordSpeedKmh = null; session.recordAcc = null;
	maybeStopSharing();
	ui.panelVisible = true; // restore panel
};

const onRecordError = (err: GeolocationPositionError): void => { ui.setStatus(geoErrorMessage(err), true); };

const onRecordUpdate = (pos: GeolocationPosition): void => {
	const latlng: LatLon = [pos.coords.latitude, pos.coords.longitude];
	const last = session.recordPoints[session.recordPoints.length - 1];
	if (last && haversine(last, latlng) < 5) return; // GPS jitter filter
	session.recordPoints.push(latlng);
	session.recordSpeedKmh = pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed * 3.6 : null;
	session.recordAcc = pos.coords.accuracy;
	redrawRecordLayer();
	// Incremental distance — avoids O(n²) full cumulative() per GPS fix.
	session.recordKm = (session.recordKm * 1000 + (last ? haversine(last, latlng) : 0)) / 1000;
	const first = session.recordPoints.length === 1;
	ensureMap();
	updateRecordMarker(latlng, first);
	shareFix(latlng, pos.coords.speed != null && pos.coords.speed >= 0 ? pos.coords.speed : null, pos.coords.accuracy);
};

export const finishRecording = async (): Promise<void> => {
	if (session.recordPoints.length < 2) { ui.setStatus('Keep moving a bit before finishing — need at least 2 points.', true); return; }
	const name = askRouteName('Name this route:', 'Recorded route');
	if (!name) return;
	const line = session.recordPoints.slice() as LatLon[];
	exitRecordMode();
	await scoreAndSaveCustomRoute(line, name, 'recorded');
};
