// Leaflet map controller — owns the single map instance and every layer the
// legacy app managed by hand. The component creates/destroys the map in a
// $effect; all other modules go through this API.
//
// Leaflet is dynamically imported: its UMD factory throws when evaluated
// without `window`, so it must never run during SSR/prerender.
import type * as LeafletTypes from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLon } from './util.js';
import { cumulative } from './util.js';
import { mergePolylines } from './engine/index.js';
import type { RouteSegment } from './engine/index.js';
import { session } from './state/session.svelte.js';
import { addDrawPoint, getDrawnPath } from './tracker.js';
import {
	styleById,
	tileUrl,
	isValidStyleId,
	defaultStyleForTheme,
	DEFAULT_LIGHT_STYLE
} from './mapStyles.js';
import { loadMapStylePref, saveMapStylePref } from './storage.js';

type L = typeof LeafletTypes;

let Leaflet: L | null = null;

export const ensureLeaflet = async (): Promise<L> => {
	if (!Leaflet) Leaflet = await import('leaflet');
	return Leaflet;
};

let map: L.Map | null = null;
let routeLayer: L.LayerGroup | null = null;
let stopMarkers: L.Marker[] = [];
let routeLine: LatLon[] = [];
let routeCum: number[] = [];
let coreLines: L.Polyline[] = [];
let planDash: L.Polyline | null = null;
let traveledHalo: L.Polyline | null = null;
let traveledCore: L.Polyline | null = null;
let progressLive = false;
let hillBadge: L.Marker | null = null;
let arrivalBadge: L.Marker | null = null;
let drawLayer: L.Polyline | null = null;
let drawMarkers: L.CircleMarker[] = [];
let recordLayer: L.Polyline | null = null;
let recordMarker: L.Marker | null = null;
let locateMarker: L.CircleMarker | null = null;
let locateAccuracyCircle: L.Circle | null = null;
let trackMarker: L.Marker | null = null;
let trackAccuracyCircle: L.Circle | null = null;

/* ---------- basemap tile styles ---------- */
let tileLayer: L.TileLayer | null = null;
let activeStyleId: string | null = null;
let stylePref = 'auto';
let themeObserver: MutationObserver | null = null;
let themeMedia: MediaQueryList | null = null;
let themeMediaHandler: (() => void) | null = null;

// Mirror of the app theme resolution: explicit data-theme wins, otherwise the
// OS preference (same rule as the pre-paint script in app.html).
export const effectiveTheme = (): 'light' | 'dark' => {
	if (typeof document === 'undefined') return 'dark';
	const t = document.documentElement.getAttribute('data-theme');
	if (t === 'gradient-dark') return 'dark';
	if (t === 'gradient') return 'light';
	if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		return 'dark';
	}
	return 'light';
};

const resolveStyleId = (pref: string): string => {
	if (pref !== 'auto' && isValidStyleId(pref)) return pref;
	return defaultStyleForTheme(effectiveTheme());
};

const applyTileStyle = (id: string): void => {
	const m = ensureMap();
	const def = styleById(id) ?? styleById(DEFAULT_LIGHT_STYLE);
	if (!def) return;
	if (tileLayer) {
		m.removeLayer(tileLayer);
		tileLayer = null;
	}
	tileLayer = l().tileLayer(tileUrl(def), {
		maxZoom: def.maxZoom,
		subdomains: def.subdomains ?? 'abc',
		attribution: def.attribution
	});
	tileLayer.addTo(m);
	m.setMaxZoom(def.maxZoom);
	// Only plain OSM ever gets the CSS invert treatment in dark mode —
	// everything else is native artwork (light or dark).
	m.getContainer().classList.toggle(
		'tiles-invert',
		effectiveTheme() === 'dark' && def.invertInDark === true
	);
	activeStyleId = def.id;
};

// Follow the app theme while the user hasn't picked an explicit style.
const watchTheme = (): void => {
	unwatchTheme();
	if (typeof document === 'undefined') return;
	const reapply = (): void => {
		if (stylePref === 'auto' && map) applyTileStyle(resolveStyleId(stylePref));
	};
	themeObserver = new MutationObserver((mutations) => {
		if (mutations.some((mu) => mu.attributeName === 'data-theme')) reapply();
	});
	themeObserver.observe(document.documentElement, { attributes: true });
	if (typeof window.matchMedia === 'function') {
		themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
		themeMediaHandler = reapply;
		themeMedia.addEventListener('change', themeMediaHandler);
	}
};

const unwatchTheme = (): void => {
	themeObserver?.disconnect();
	themeObserver = null;
	if (themeMedia && themeMediaHandler) {
		themeMedia.removeEventListener('change', themeMediaHandler);
	}
	themeMedia = null;
	themeMediaHandler = null;
};

/** Persist the user's choice ('auto' follows the app theme) and apply it. */
export const setMapStyle = (id: string): void => {
	stylePref = id === 'auto' || isValidStyleId(id) ? id : 'auto';
	saveMapStylePref(stylePref);
	if (map) applyTileStyle(resolveStyleId(stylePref));
};

export const getMapStyleId = (): string | null => activeStyleId;
export const getMapStylePref = (): string => stylePref;

export const createMap = async (container: HTMLElement, center: LatLon): Promise<L.Map> => {
	const Leaf = await ensureLeaflet();
	map = Leaf.map(container, { zoomControl: false }).setView(center, 13);
	Leaf.control.zoom({ position: 'topright' }).addTo(map);
	// Basemap follows the saved style pref (or the app theme when 'auto').
	stylePref = loadMapStylePref();
	applyTileStyle(resolveStyleId(stylePref));
	watchTheme();

	// Panning away from the live marker while tracking means the rider wants
	// to look around — stop auto-recentring until they ask to jump back.
	map.on('dragstart', () => {
		if (session.trackingActive && session.following) {
			session.following = false;
			session.recenterVisible = true;
		}
	});

	map.on('click', onMapClick);
	return map;
};

// browser-only layer helpers grab the loaded namespace through this getter
const l = (): L => {
	if (!Leaflet) throw new Error('Leaflet not loaded — call ensureLeaflet()/createMap() first');
	return Leaflet;
};

export const destroyMap = (): void => {
	unwatchTheme();
	if (map) {
		map.remove();
		map = null;
	}
	tileLayer = null;
	activeStyleId = null;
	routeLayer = null;
	stopMarkers = [];
	routeLine = [];
	routeCum = [];
	coreLines = [];
	planDash = null;
	traveledHalo = null;
	traveledCore = null;
	progressLive = false;
	hillBadge = null;
	arrivalBadge = null;
	drawLayer = null;
	drawMarkers = [];
	recordLayer = null;
	recordMarker = null;
	locateMarker = null;
	locateAccuracyCircle = null;
	trackMarker = null;
	trackAccuracyCircle = null;
	friendLayer = null;
};

export const getMap = (): L.Map | null => map;

export const ensureMap = (): L.Map => {
	if (!map) throw new Error('Map not initialised');
	return map;
};

/* ---------- route rendering ---------- */
const stopMapIcon = (i: number, n: number): L.DivIcon => {
	if (i === 0) {
		return l().divIcon({
			className: '',
			html: '<div class="stop-origin"></div>',
			iconSize: [16, 16],
			iconAnchor: [8, 8]
		});
	}
	if (i === n - 1) {
		return l().divIcon({
			className: '',
			html: '<div class="stop-dest"></div>',
			iconSize: [16, 16],
			iconAnchor: [8, 8]
		});
	}
	return l().divIcon({
		className: '',
		html: `<div style="width:18px;height:18px;border-radius:50%;background:#1b2125;color:#FFFFFF;border:1px solid #FFFFFF;font-weight:700;font-size:10px;font-family:var(--font-mono);display:flex;align-items:center;justify-content:center;">${i}</div>`,
		iconSize: [16, 16],
		iconAnchor: [8, 8]
	});
};

export const renderRoute = (
	segs: RouteSegment[],
	line: LatLon[],
	coords: LatLon[],
	neon = '#60a5fa'
): void => {
	const m = ensureMap();
	if (routeLayer) routeLayer.remove();
	stopMarkers.forEach((mk) => mk.remove());
	stopMarkers = [];
	clearRouteProgress();
	clearHillBadge();
	clearArrivalBadge();
	routeLine = line;
	routeCum = cumulative(line);
	coreLines = [];

	const group = l().layerGroup();
	l().polyline(line, {
		color: neon,
		weight: 13,
		opacity: 0.22,
		lineCap: 'round',
		lineJoin: 'round',
		interactive: false
	}).addTo(group);
	l().polyline(line, {
		color: '#020617',
		weight: 8,
		opacity: 0.9,
		lineCap: 'round',
		lineJoin: 'round',
		className: 'route-casing',
		interactive: false
	}).addTo(group);
	for (const g of mergePolylines(segs)) {
		const core = l().polyline(g.pts, {
			color: g.c,
			weight: 4.5,
			opacity: 0.95,
			lineCap: 'round',
			lineJoin: 'round',
			className: 'route-glow route-draw',
			interactive: false
		});
		core.addTo(group);
		coreLines.push(core);
	}
	group.addTo(m);
	routeLayer = group;

	coords.forEach((c, i) => {
		stopMarkers.push(l().marker(c, { icon: stopMapIcon(i, coords.length) }).addTo(m));
	});

	m.fitBounds(l().latLngBounds(line), { padding: [40, 40] });
};

/* ---------- live progress: traveled cyan vs dashed-blue remaining ---------- */
const cutLineAt = (dist: number): LatLon[] => {
	if (routeLine.length < 2) return [];
	let lo = 0;
	let hi = routeCum.length - 1;
	while (lo < hi) {
		const mid = (lo + hi + 1) >> 1;
		if (routeCum[mid] <= dist) lo = mid;
		else hi = mid - 1;
	}
	const out = routeLine.slice(0, lo + 1);
	if (lo + 1 < routeLine.length) {
		const segLen = routeCum[lo + 1] - routeCum[lo] || 1;
		const t = Math.min(1, Math.max(0, (dist - routeCum[lo]) / segLen));
		out.push([
			routeLine[lo][0] + (routeLine[lo + 1][0] - routeLine[lo][0]) * t,
			routeLine[lo][1] + (routeLine[lo + 1][1] - routeLine[lo][1]) * t
		]);
	}
	return out;
};

export const setRouteProgress = (distAlong: number): void => {
	const m = getMap();
	if (!m || routeLine.length < 2) return;
	if (!progressLive) {
		coreLines.forEach((c) => c.setStyle({ opacity: 0.35 }));
		planDash = l().polyline(routeLine, {
			color: '#60a5fa',
			weight: 5,
			opacity: 0.85,
			lineCap: 'round',
			dashArray: '10 9',
			className: 'line-march',
			interactive: false
		}).addTo(m);
		traveledHalo = l().polyline([], {
			color: '#22d3ee',
			weight: 11,
			opacity: 0.3,
			lineCap: 'round',
			interactive: false
		}).addTo(m);
		traveledCore = l().polyline([], {
			color: '#22d3ee',
			weight: 5,
			opacity: 1,
			lineCap: 'round',
			lineJoin: 'round',
			className: 'route-glow',
			interactive: false
		}).addTo(m);
		progressLive = true;
	}
	const path = cutLineAt(Math.max(0, distAlong));
	if (path.length < 2) {
		traveledHalo?.setLatLngs([]);
		traveledCore?.setLatLngs([]);
		return;
	}
	traveledHalo?.setLatLngs(path);
	traveledCore?.setLatLngs(path);
};

export const clearRouteProgress = (): void => {
	planDash?.remove();
	planDash = null;
	traveledHalo?.remove();
	traveledHalo = null;
	traveledCore?.remove();
	traveledCore = null;
	coreLines.forEach((c) => c.setStyle({ opacity: 0.95 }));
	coreLines = [];
	routeLine = [];
	routeCum = [];
	progressLive = false;
};

/* ---------- floating badges: hill warnings + arrival ---------- */
const fmtAhead = (m: number): string => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

let hillKey = '';

export const showHillBadge = (at: LatLon, gradePct: number, aheadM: number, danger: boolean): void => {
	const key = `${Math.round(gradePct)}|${danger ? 1 : 0}|${Math.round(aheadM / 50)}`;
	if (hillBadge && key === hillKey) return;
	hillKey = key;
	const m = ensureMap();
	clearHillBadge();
	hillBadge = l().marker(at, {
		icon: l().divIcon({
			className: 'badge-wrap',
			html: `<div class="hill-badge${danger ? ' danger' : ''}"><strong>${danger ? 'BRAKE LIMIT' : 'STEEP DESCENT'}</strong><span>▼ ${Math.abs(gradePct).toFixed(0)}% · ${fmtAhead(aheadM)}</span></div>`,
			iconSize: [148, 48],
			iconAnchor: [74, 54]
		}),
		interactive: false,
		keyboard: false
	}).addTo(m);
};

export const clearHillBadge = (): void => {
	hillBadge?.remove();
	hillBadge = null;
	hillKey = '';
};

export const showArrivalBadge = (at: LatLon): void => {
	const m = ensureMap();
	clearArrivalBadge();
	arrivalBadge = l().marker(at, {
		icon: l().divIcon({
			className: 'badge-wrap',
			html: '<div class="arrival-banner"><strong>YOU’RE HERE</strong><span>RIDE COMPLETE</span></div>',
			iconSize: [188, 46],
			iconAnchor: [94, 52]
		}),
		interactive: false,
		keyboard: false
	}).addTo(m);
};

export const clearArrivalBadge = (): void => {
	arrivalBadge?.remove();
	arrivalBadge = null;
};

/* ---------- draw mode ---------- */
const onMapClick = (e: L.LeafletMouseEvent): void => {
	if (session.drawMode) {
		addDrawPoint([e.latlng.lat, e.latlng.lng]);
	}
};

export const redrawDrawLayer = (): void => {
	const m = ensureMap();
	clearDrawLayer();
	const path = getDrawnPath();
	if (path.length > 1) {
		drawLayer = l().polyline(path, {
			color: '#60a5fa',
			weight: 4,
			dashArray: '10 9',
			className: 'line-march line-glow'
		}).addTo(m);
	}
	session.drawPoints.forEach((p) => {
		drawMarkers.push(
			l().circleMarker(p, {
				radius: 5,
				color: '#60a5fa',
				weight: 2,
				fillColor: '#60a5fa',
				fillOpacity: 1,
				className: 'node-glow'
			}).addTo(m)
		);
	});
};

export const clearDrawLayer = (): void => {
	if (drawLayer) {
		drawLayer.remove();
		drawLayer = null;
	}
	drawMarkers.forEach((mk) => mk.remove());
	drawMarkers = [];
};

export const setDrawCursor = (crosshair: boolean): void => {
	if (!map) return;
	map.getContainer().style.cursor = crosshair ? 'crosshair' : '';
};

/* ---------- record mode ---------- */
export const redrawRecordLayer = (): void => {
	const m = ensureMap();
	if (recordLayer) {
		recordLayer.remove();
		recordLayer = null;
	}
	if (session.recordPoints.length > 1) {
		recordLayer = l().polyline(session.recordPoints, { color: '#ef4444', weight: 4 }).addTo(m);
	}
};

export const updateRecordMarker = (latlng: LatLon, first: boolean): void => {
	const m = ensureMap();
	if (first) {
		recordMarker = l().marker(latlng, {
			icon: l().divIcon({ className: '', html: '<div class="rec-head"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }),
			interactive: false,
			keyboard: false
		}).addTo(m);
		m.setView(latlng, Math.max(m.getZoom(), 16));
	} else if (recordMarker) {
		recordMarker.setLatLng(latlng);
		m.panTo(latlng);
	}
};

export const clearRecordLayer = (): void => {
	if (recordLayer) {
		recordLayer.remove();
		recordLayer = null;
	}
	if (recordMarker) {
		recordMarker.remove();
		recordMarker = null;
	}
};

/* ---------- locate ---------- */
export const showLocateMarker = (latlng: LatLon, accuracy: number): void => {
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
};

/* ---------- live tracking marker (owned here, driven by tracker.ts) ---------- */
export const updateTrackMarker = (latlng: LatLon, accuracy: number): void => {
	const m = ensureMap();
	if (!trackMarker) {
		trackMarker = l()
			.marker(latlng, {
				icon: l().divIcon({ className: '', html: '<div class="rider-dot"></div>', iconSize: [28, 28], iconAnchor: [14, 14] }),
				interactive: false,
				keyboard: false,
				zIndexOffset: 1000
			})
			.addTo(m);
	} else {
		trackMarker.setLatLng(latlng);
	}
	if (trackAccuracyCircle) trackAccuracyCircle.remove();
	trackAccuracyCircle = l()
		.circle(latlng, {
			radius: accuracy,
			color: '#22d3ee',
			weight: 1.5,
			fillOpacity: 0.07,
			dashArray: '2 6',
			className: 'halo-march',
			interactive: false
		})
		.addTo(m);
};

export const clearTrackMarker = (): void => {
	if (trackMarker) {
		trackMarker.remove();
		trackMarker = null;
	}
	if (trackAccuracyCircle) {
		trackAccuracyCircle.remove();
		trackAccuracyCircle = null;
	}
};

/* ---------- friend live markers (driven by the social SSE feed) ---------- */
export interface FriendPin {
	id: string;
	name: string;
	avatar: string;
	lat: number;
	lon: number;
	stale: boolean;
}

let friendLayer: L.LayerGroup | null = null;

const escHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const friendIconHtml = (f: FriendPin): string => {
	const face = f.avatar
		? `<img src="${escHtml(f.avatar)}" alt="" referrerpolicy="no-referrer" />`
		: `<span aria-hidden="true">${escHtml((f.name || 'R')[0]?.toUpperCase() ?? 'R')}</span>`;
	return `<div class="friend-pin${f.stale ? ' is-stale' : ''}">${f.stale ? '' : '<i class="friend-ring" aria-hidden="true"></i>'}<span class="friend-face">${face}</span></div>`;
};

export const renderFriendMarkers = (friends: FriendPin[]): void => {
	let m: L.Map;
	try {
		m = ensureMap();
	} catch {
		return; // map not ready yet — next SSE poll re-renders
	}
	if (!friendLayer) friendLayer = l().layerGroup().addTo(m);
	friendLayer.clearLayers();
	for (const f of friends) {
		if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon)) continue;
		l()
			.marker([f.lat, f.lon], {
				icon: l().divIcon({
					className: '',
					html: friendIconHtml(f),
					iconSize: [40, 46],
					iconAnchor: [20, 42]
				}),
				keyboard: false,
				title: f.name,
				zIndexOffset: 900,
				interactive: true
			})
			.bindTooltip(escHtml(f.name), {
				direction: 'top',
				offset: [0, -44],
				className: 'friend-tip',
				opacity: 1
			})
			.addTo(friendLayer);
	}
};

export const clearFriendMarkers = (): void => {
	if (friendLayer) friendLayer.clearLayers();
};
