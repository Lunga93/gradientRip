// Leaflet map controller — owns the single map instance and every layer the
// legacy app managed by hand. The component creates/destroys the map in a
// $effect; all other modules go through this API.
//
// Leaflet is dynamically imported: its UMD factory throws when evaluated
// without `window`, so it must never run during SSR/prerender.
import type * as LeafletTypes from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLon } from './util.js';
import { mergePolylines } from './scoring.js';
import type { RouteSegment } from './scoring.js';
import { app } from './state/app.svelte.js';

type L = typeof LeafletTypes;

let Leaflet: L | null = null;

export async function ensureLeaflet(): Promise<L> {
	if (!Leaflet) Leaflet = await import('leaflet');
	return Leaflet;
}

let map: L.Map | null = null;
let routeLayer: L.LayerGroup | null = null;
let stopMarkers: L.Marker[] = [];
let drawLayer: L.Polyline | null = null;
let drawMarkers: L.CircleMarker[] = [];
let recordLayer: L.Polyline | null = null;
let recordMarker: L.CircleMarker | null = null;
let locateMarker: L.CircleMarker | null = null;
let locateAccuracyCircle: L.Circle | null = null;

export async function createMap(container: HTMLElement, center: LatLon): Promise<L.Map> {
	const L = await ensureLeaflet();
	map = L.map(container, { zoomControl: false }).setView(center, 13);
	L.control.zoom({ position: 'topright' }).addTo(map);
	// Standard OSM raster tiles — free, keyless. The dark look is re-derived
	// with a CSS invert filter (see app.css #map .leaflet-tile-pane).
	L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
		maxZoom: 19,
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
	}).addTo(map);

	// Panning away from the live marker while tracking means the rider wants
	// to look around — stop auto-recentring until they ask to jump back.
	map.on('dragstart', () => {
		if (app.trackingActive && app.following) {
			app.following = false;
			app.recenterVisible = true;
		}
	});

	map.on('click', onMapClick);
	return map;
}

// browser-only layer helpers grab the loaded namespace through this getter
function l(): L {
	if (!Leaflet) throw new Error('Leaflet not loaded — call ensureLeaflet()/createMap() first');
	return Leaflet;
}

export function destroyMap(): void {
	if (map) {
		map.remove();
		map = null;
	}
	routeLayer = null;
	stopMarkers = [];
	drawLayer = null;
	drawMarkers = [];
	recordLayer = null;
	recordMarker = null;
	locateMarker = null;
	locateAccuracyCircle = null;
}

export function getMap(): L.Map | null {
	return map;
}

export function ensureMap(): L.Map {
	if (!map) throw new Error('Map not initialised');
	return map;
}

/* ---------- route rendering ---------- */
function stopMapIcon(i: number, n: number): L.DivIcon {
	if (i === 0) {
		return l().divIcon({
			className: '',
			html: '<div style="width:14px;height:14px;border-radius:50%;background:#FFFFFF;border:2px solid #12161A;box-shadow:0 0 0 2px #FFFFFF, 0 0 10px rgba(255,255,255,.7);"></div>',
			iconSize: [14, 14],
			iconAnchor: [7, 7]
		});
	}
	if (i === n - 1) {
		return l().divIcon({
			className: '',
			html: '<svg width="26" height="26" viewBox="0 0 24 24"><path fill="#ff5a52" stroke="#12161A" stroke-width="1" d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.62 6.5 12 7.09 12.56a.55.55 0 00.82 0C13 21.5 19.5 15.12 19.5 9.5 19.5 5.36 16.14 2 12 2zm0 10.25A2.75 2.75 0 1112 6.75a2.75 2.75 0 010 5.5z"/></svg>',
			iconSize: [26, 26],
			iconAnchor: [13, 24]
		});
	}
	return l().divIcon({
		className: '',
		html: `<div style="width:18px;height:18px;border-radius:50%;background:#1b2125;color:#FFFFFF;border:1px solid #FFFFFF;font:700 10px Roboto,sans-serif;display:flex;align-items:center;justify-content:center;">${i}</div>`,
		iconSize: [16, 16],
		iconAnchor: [8, 8]
	});
}

export function renderRoute(segs: RouteSegment[], line: LatLon[], coords: LatLon[]): void {
	const m = ensureMap();
	if (routeLayer) routeLayer.remove();
	stopMarkers.forEach((mk) => mk.remove());
	stopMarkers = [];

	const group = l().layerGroup();
	for (const g of mergePolylines(segs)) {
		l().polyline(g.pts, {
			color: '#0c0f10',
			weight: 9,
			opacity: 0.95,
			lineCap: 'round',
			lineJoin: 'round',
			className: 'route-casing',
			interactive: false
		}).addTo(group);
		l().polyline(g.pts, {
			color: g.c,
			weight: 5,
			opacity: 0.95,
			lineCap: 'round',
			lineJoin: 'round',
			className: 'route-glow'
		}).addTo(group);
	}
	group.addTo(m);
	routeLayer = group;

	coords.forEach((c, i) => {
		stopMarkers.push(l().marker(c, { icon: stopMapIcon(i, coords.length) }).addTo(m));
	});

	m.fitBounds(l().latLngBounds(line), { padding: [40, 40] });
}

export function clearRoute(): void {
	if (routeLayer) {
		routeLayer.remove();
		routeLayer = null;
	}
	stopMarkers.forEach((mk) => mk.remove());
	stopMarkers = [];
}

/* ---------- draw mode ---------- */
function onMapClick(e: L.LeafletMouseEvent) {
	if (app.drawMode) {
		app.drawPoints.push([e.latlng.lat, e.latlng.lng]);
		redrawDrawLayer();
	}
}

export function redrawDrawLayer(): void {
	const m = ensureMap();
	clearDrawLayer();
	if (app.drawPoints.length > 1) {
		drawLayer = l().polyline(app.drawPoints, { color: '#FFFFFF', weight: 4, dashArray: '6 8' }).addTo(m);
	}
	app.drawPoints.forEach((p) => {
		drawMarkers.push(
			l().circleMarker(p, {
				radius: 5,
				color: '#12161A',
				weight: 1,
				fillColor: '#FFFFFF',
				fillOpacity: 1
			}).addTo(m)
		);
	});
}

export function clearDrawLayer(): void {
	if (drawLayer) {
		drawLayer.remove();
		drawLayer = null;
	}
	drawMarkers.forEach((mk) => mk.remove());
	drawMarkers = [];
}

export function setDrawCursor(crosshair: boolean): void {
	if (!map) return;
	map.getContainer().style.cursor = crosshair ? 'crosshair' : '';
}

/* ---------- record mode ---------- */
export function redrawRecordLayer(): void {
	const m = ensureMap();
	if (recordLayer) {
		recordLayer.remove();
		recordLayer = null;
	}
	if (app.recordPoints.length > 1) {
		recordLayer = l().polyline(app.recordPoints, { color: '#ff5a52', weight: 4 }).addTo(m);
	}
}

export function updateRecordMarker(latlng: LatLon, first: boolean): void {
	const m = ensureMap();
	if (first) {
		recordMarker = l().circleMarker(latlng, {
			radius: 7,
			color: '#fff',
			weight: 2,
			fillColor: '#ff5a52',
			fillOpacity: 0.95
		}).addTo(m);
		m.setView(latlng, Math.max(m.getZoom(), 16));
	} else if (recordMarker) {
		recordMarker.setLatLng(latlng);
		m.panTo(latlng);
	}
}

export function clearRecordLayer(): void {
	if (recordLayer) {
		recordLayer.remove();
		recordLayer = null;
	}
	if (recordMarker) {
		recordMarker.remove();
		recordMarker = null;
	}
}

/* ---------- locate ---------- */
export function showLocateMarker(latlng: LatLon, accuracy: number): void {
	const m = ensureMap();
	m.setView(latlng, 16);
	if (locateMarker) locateMarker.remove();
	if (locateAccuracyCircle) locateAccuracyCircle.remove();
	locateMarker = l().circleMarker(latlng, {
		radius: 8,
		color: '#FFFFFF',
		weight: 2,
		fillColor: '#FFFFFF',
		fillOpacity: 0.35
	}).addTo(m);
	// A visible accuracy radius (metres -> map units via a real circle,
	// not the marker's pixel radius) so a bad fix is visible, not just implied.
	locateAccuracyCircle = l().circle(latlng, {
		radius: accuracy,
		color: '#FFFFFF',
		weight: 1,
		fillOpacity: 0.06,
		dashArray: '4 4'
	}).addTo(m);
}
