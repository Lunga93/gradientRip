// Session management — GPS tracking, draw mode, record mode.
// Ported from the legacy app. All three are mutually exclusive.

import type * as LeafletTypes from 'leaflet';
import { nearestOnLine, haversine, cumulative, geoErrorMessage } from './util.js';
import type { LatLon } from './util.js';
import { app, registerStopTracking } from './state/app.svelte.js';
import { getMap, ensureLeaflet } from './mapController.svelte.js';
import {
	redrawDrawLayer, clearDrawLayer, setDrawCursor,
	redrawRecordLayer, clearRecordLayer, ensureMap
} from './mapController.svelte.js';
import { scoreAndSaveCustomRoute } from './planner.svelte.js';

/* ---------- tracking ---------- */

interface Tracking {
	watchId: number | null;
	marker: LeafletTypes.CircleMarker | null;
	accCircle: LeafletTypes.Circle | null;
	lastLatLng: LatLon | null;
}
const tracking: Tracking = { watchId: null, marker: null, accCircle: null, lastLatLng: null };

function setTrackMsg(msg: string, warn: boolean) {
	app.trackingMsg = msg;
	app.trackingWarn = warn;
}

export function startTracking() {
	if (!app.currentRoute) return;
	if (!navigator.geolocation) { setTrackMsg('Geolocation is not available in this browser.', true); return; }
	if (app.drawMode) exitDrawMode();
	if (app.recordMode) exitRecordMode();
	app.following = true;
	app.trackingActive = true;
	app.trackingStats = null;
	setTrackMsg('Starting GPS tracking — this uses more battery than normal use.', false);
	tracking.watchId = navigator.geolocation.watchPosition(onTrackUpdate, onTrackError, {
		enableHighAccuracy: true, maximumAge: 2000, timeout: 15000
	});
}

export function stopTracking() {
	if (tracking.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(tracking.watchId);
	tracking.watchId = null;
	app.following = true;
	app.trackingActive = false;
	app.trackingStats = null;
	app.recenterVisible = false;
	tracking.lastLatLng = null;
	tracking.marker?.remove(); tracking.marker = null;
	tracking.accCircle?.remove(); tracking.accCircle = null;
	setTrackMsg('', false);
}

registerStopTracking(stopTracking);

function onTrackError(err: GeolocationPositionError) {
	if (!tracking.marker) stopTracking(); // no first fix yet → revert planControls
	setTrackMsg(geoErrorMessage(err), true);
}

async function onTrackUpdate(pos: GeolocationPosition) {
	if (!app.currentRoute) return;
	const L = await ensureLeaflet();
	const m = getMap(); if (!m) return;
	const { latitude, longitude, accuracy } = pos.coords;
	const latlng: LatLon = [latitude, longitude];
	tracking.lastLatLng = latlng;

	if (!tracking.marker) {
		tracking.marker = L.circleMarker(latlng, { radius: 8, color: '#fff', weight: 2, fillColor: '#1a73e8', fillOpacity: 0.95 }).addTo(m);
	} else { tracking.marker.setLatLng(latlng); }
	tracking.accCircle?.remove();
	tracking.accCircle = L.circle(latlng, { radius: accuracy, color: '#1a73e8', weight: 1, fillOpacity: 0.08 }).addTo(m);

	const { distAlong, offRoute } = nearestOnLine(latlng, app.currentRoute.line, app.currentRoute.lineCum);
	const totalDist = app.currentRoute.lineCum[app.currentRoute.lineCum.length - 1] || 1;
	const pct = Math.min(100, Math.max(0, (distAlong / totalDist) * 100));
	app.trackingStats = { pct: Math.round(pct), remainingKm: ((Math.max(0, totalDist - distAlong)) / 1000).toFixed(1) + ' km', acc: `±${Math.round(accuracy)} m` };
	if (app.following) {
		if (offRoute > 300) m.fitBounds(L.latLngBounds([...app.currentRoute.line, latlng]), { padding: [40, 40] });
		else m.setView(latlng, Math.max(m.getZoom(), 16));
	}
	setTrackMsg(offRoute > 50 ? `${Math.round(offRoute)} m from the planned route.` : '', offRoute > 50);
}

export function recenter() {
	app.following = true;
	app.recenterVisible = false;
	if (tracking.lastLatLng) { const m = getMap(); if (m) m.setView(tracking.lastLatLng, Math.max(m.getZoom(), 16)); }
}

/* ---------- draw mode ---------- */

export function enterDrawMode() {
	if (app.trackingActive) stopTracking();
	if (app.recordMode) exitRecordMode();
	app.drawMode = true; app.drawPoints = [];
	setDrawCursor(true); redrawDrawLayer();
	app.setStatus('Tap the map to trace your route, then hit Finish.');
}

export function exitDrawMode() {
	app.drawMode = false; setDrawCursor(false); clearDrawLayer(); app.drawPoints = [];
}

export function undoDrawPoint() { app.drawPoints.pop(); redrawDrawLayer(); }

export async function finishDrawing() {
	if (app.drawPoints.length < 2) { app.setStatus('Add at least 2 points before finishing.', true); return; }
	const name = window.prompt('Name this route:', 'Custom shortcut');
	if (!name) return;
	const line = app.drawPoints.slice() as LatLon[];
	exitDrawMode();
	await scoreAndSaveCustomRoute(line, name, 'drawn');
}

/* ---------- record mode ---------- */

let recordWatchId: number | null = null;

export function enterRecordMode() {
	if (!navigator.geolocation) { app.setStatus('Geolocation is not available in this browser.', true); return; }
	if (app.trackingActive) stopTracking();
	if (app.drawMode) exitDrawMode();
	app.recordMode = true; app.recordPoints = []; app.recordKm = 0;
	app.setStatus('Recording your live path — move to trace the route, then hit Finish.');
	recordWatchId = navigator.geolocation.watchPosition(onRecordUpdate, onRecordError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 });
}

export function exitRecordMode() {
	app.recordMode = false;
	if (recordWatchId != null && navigator.geolocation) navigator.geolocation.clearWatch(recordWatchId);
	recordWatchId = null; clearRecordLayer(); app.recordPoints = []; app.recordKm = 0;
}

function onRecordError(err: GeolocationPositionError) { app.setStatus(geoErrorMessage(err), true); }

function onRecordUpdate(pos: GeolocationPosition) {
	const latlng: LatLon = [pos.coords.latitude, pos.coords.longitude];
	const last = app.recordPoints[app.recordPoints.length - 1];
	if (last && haversine(last, latlng) < 5) return; // GPS jitter filter
	app.recordPoints.push(latlng); redrawRecordLayer();
	app.recordKm = (app.recordPoints.length > 1 ? cumulative(app.recordPoints).at(-1)! : 0) / 1000;
	const first = app.recordPoints.length === 1;
	ensureMap();
	import('./mapController.svelte.js').then(m => m.updateRecordMarker(latlng, first));
}

export async function finishRecording() {
	if (app.recordPoints.length < 2) { app.setStatus('Keep moving a bit before finishing — need at least 2 points.', true); return; }
	const name = window.prompt('Name this route:', 'Recorded route');
	if (!name) return;
	const line = app.recordPoints.slice() as LatLon[];
	exitRecordMode();
	await scoreAndSaveCustomRoute(line, name, 'recorded');
}
