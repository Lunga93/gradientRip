// Session management — GPS tracking, draw mode, record mode.
// Ported from the legacy app. All three are mutually exclusive.

import { nearestOnLine, haversine, geoErrorMessage } from './util.js';
import type { LatLon } from './util.js';
import { domain } from './state/domain.svelte.js';
import { ui } from './state/ui.svelte.js';
import { session } from './state/session.svelte.js';
import { getMap, ensureLeaflet } from './mapController.svelte.js';
import {
	redrawDrawLayer, clearDrawLayer, setDrawCursor,
	redrawRecordLayer, clearRecordLayer, ensureMap,
	updateTrackMarker, clearTrackMarker, updateRecordMarker
} from './mapController.svelte.js';
import { scoreAndSaveCustomRoute, askRouteName } from './planner.svelte.js';

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

export const startTracking = (): void => {
	if (!domain.currentRoute) return;
	if (!navigator.geolocation) { setTrackMsg('Geolocation is not available in this browser.', true); return; }
	if (session.drawMode) exitDrawMode();
	if (session.recordMode) exitRecordMode();
	session.following = true;
	session.trackingActive = true;
	session.trackingStats = null;
	setTrackMsg('Starting GPS tracking — this uses more battery than normal use.', false);
	tracking.watchId = navigator.geolocation.watchPosition(onTrackUpdate, onTrackError, {
		enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
	});
};

export const stopTracking = (): void => {
	if (tracking.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(tracking.watchId);
	tracking.watchId = null;
	session.following = true;
	session.trackingActive = false;
	session.trackingStats = null;
	session.recenterVisible = false;
	tracking.lastLatLng = null;
	tracking.hasFix = false;
	clearTrackMarker();
	setTrackMsg('', false);
};

const onTrackError = (err: GeolocationPositionError): void => {
	if (!tracking.hasFix) stopTracking(); // no first fix yet → revert planControls
	setTrackMsg(geoErrorMessage(err), true);
};

const onTrackUpdate = async (pos: GeolocationPosition): Promise<void> => {
	if (!domain.currentRoute) return;
	const L = await ensureLeaflet();
	const m = getMap(); if (!m) return;
	const { latitude, longitude, accuracy } = pos.coords;
	const latlng: LatLon = [latitude, longitude];
	tracking.lastLatLng = latlng;
	tracking.hasFix = true;
	updateTrackMarker(latlng, accuracy);

	const { distAlong, offRoute } = nearestOnLine(latlng, domain.currentRoute.line, domain.currentRoute.lineCum);
	const totalDist = domain.currentRoute.lineCum[domain.currentRoute.lineCum.length - 1] || 1;
	const pct = Math.min(100, Math.max(0, (distAlong / totalDist) * 100));
	session.trackingStats = { pct: Math.round(pct), remainingKm: ((Math.max(0, totalDist - distAlong)) / 1000).toFixed(1) + ' km', acc: `±${Math.round(accuracy)} m` };
	if (session.following) {
		if (offRoute > 300) m.fitBounds(L.latLngBounds([...domain.currentRoute.line, latlng]), { padding: [40, 40] });
		else m.setView(latlng, Math.max(m.getZoom(), 16));
	}
	setTrackMsg(offRoute > 50 ? `${Math.round(offRoute)} m from the planned route.` : '', offRoute > 50);
};

export const recenter = (): void => {
	session.following = true;
	session.recenterVisible = false;
	if (tracking.lastLatLng) { const m = getMap(); if (m) m.setView(tracking.lastLatLng, Math.max(m.getZoom(), 16)); }
};

/* ---------- draw mode ---------- */

export const enterDrawMode = (): void => {
	if (session.trackingActive) stopTracking();
	if (session.recordMode) exitRecordMode();
	session.drawMode = true; session.drawPoints = [];
	setDrawCursor(true); redrawDrawLayer();
	ui.setStatus('Tap the map to trace your route, then hit Finish.');
};

export const exitDrawMode = (): void => {
	session.drawMode = false; setDrawCursor(false); clearDrawLayer(); session.drawPoints = [];
};

export const undoDrawPoint = (): void => { session.drawPoints.pop(); redrawDrawLayer(); };

export const finishDrawing = async (): Promise<void> => {
	if (session.drawPoints.length < 2) { ui.setStatus('Add at least 2 points before finishing.', true); return; }
	const name = askRouteName('Name this route:', 'Custom shortcut');
	if (!name) return;
	const line = session.drawPoints.slice() as LatLon[];
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
	ui.setStatus('Recording your live path — move to trace the route, then hit Finish.');
	recordWatchId = navigator.geolocation.watchPosition(onRecordUpdate, onRecordError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
};

export const exitRecordMode = (): void => {
	session.recordMode = false;
	if (recordWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(recordWatchId);
	recordWatchId = null; clearRecordLayer(); session.recordPoints = []; session.recordKm = 0;
};

const onRecordError = (err: GeolocationPositionError): void => { ui.setStatus(geoErrorMessage(err), true); };

const onRecordUpdate = (pos: GeolocationPosition): void => {
	const latlng: LatLon = [pos.coords.latitude, pos.coords.longitude];
	const last = session.recordPoints[session.recordPoints.length - 1];
	if (last && haversine(last, latlng) < 5) return; // GPS jitter filter
	session.recordPoints.push(latlng);
	redrawRecordLayer();
	// Incremental distance — avoids O(n²) full cumulative() per GPS fix.
	session.recordKm = (session.recordKm * 1000 + (last ? haversine(last, latlng) : 0)) / 1000;
	const first = session.recordPoints.length === 1;
	ensureMap();
	updateRecordMarker(latlng, first);
};

export const finishRecording = async (): Promise<void> => {
	if (session.recordPoints.length < 2) { ui.setStatus('Keep moving a bit before finishing — need at least 2 points.', true); return; }
	const name = askRouteName('Name this route:', 'Recorded route');
	if (!name) return;
	const line = session.recordPoints.slice() as LatLon[];
	exitRecordMode();
	await scoreAndSaveCustomRoute(line, name, 'recorded');
};
