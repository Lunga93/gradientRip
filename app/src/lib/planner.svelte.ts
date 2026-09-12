import { MODES } from './engine/index.js';
import { elevations, reverseGeocode, detectCountry, route as fetchRoute } from './api.js';
import { geoState } from './geo-state.svelte.js';
import { resample, geoErrorMessage, RESAMPLE_STEP_M, cumulative, haversine } from './util.js';
import type { LatLon } from './util.js';
import { domain } from './state/domain.svelte.js';
import { ui } from './state/ui.svelte.js';
import { session } from './state/session.svelte.js';
import { nextStopId } from './state/domain.svelte.js';
import { renderRoute } from './mapController.svelte.js';
import { verdictHex } from './verdictTheme.js';
import { startTracking, stopTracking } from './tracker.js';
import { buildPlanPacket, routeSegments, decide, type PlanPacket, type PlanSource } from './engine/index.js';
import { TRIPS_MAX, saveTrips, savePresets } from './storage.js';
import { planRoute } from './plan.remote.js';
import { fetchBackup, pushBackup } from './sync.js';
import type { Trip } from './storage.js';

const SNAP_FACTOR = 1.6;

export const isMobileView = (): boolean =>
	typeof window !== 'undefined' && window.matchMedia('(max-width:640px)').matches;

// Client entry for the Plan form: calls the typed remote command (server
// runs the whole geocode→route→elevation→score pipeline) and finalises the
// returned packet. Reads like the flow it is: set busy → call → render.
export const runPlan = async (): Promise<void> => {
	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		ui.setStatus('You are offline — planning a new route needs a connection, but saved trips still open.', true);
		return;
	}
	if (session.planning) return;
	if (domain.stops.length < 2 || domain.stops.some((s) => !s.value.trim())) {
		ui.setStatus('Every stop needs a place before you can plan the route.', true);
		return;
	}
	session.planning = true;
	domain.results = null;
	ui.setStatus('Planning your ride…');
	try {
		const packet = await planRoute({
			stops: domain.stops.map((s) => ({ value: s.value, coords: s.coords })),
			boardVal: domain.boardVal || domain.boards[0].value,
			modeId: domain.modeId,
			country: geoState.country
		});
		finalisePlan(packet);
	} catch (err) {
		const msg = (err as { body?: { message?: string }; message?: string })?.body?.message
			?? (err as Error)?.message
			?? 'Something went wrong.';
		ui.setStatus(msg, true);
	} finally {
		session.planning = false;
	}
};

// Browser-side half of a successful plan (planned, drawn or recorded).
export const finalisePlan = (packet: PlanPacket) => {
	// A fresh plan replaces whatever route live tracking was following —
	// stop any in-progress session before swapping the data out from under it.
	stopTracking();
	domain.applyResult({
		verdict: packet.verdict,
		pts: packet.pts,
		elev: packet.elev,
		cum: packet.cum,
		totalWh: packet.totalWh,
		totalClimb: packet.totalClimb,
		usableWh: packet.usableWh,
		mode: MODES[packet.modeId] ?? MODES.eskate,
		segs: packet.segs,
		line: packet.line,
		coords: packet.coords
	});
	renderRoute(packet.segs, packet.line, packet.coords, verdictHex(packet.verdict.level));

	if (isMobileView()) ui.setSheet(true);

	domain.addTrip({
		ts: Date.now(),
		modeId: packet.modeId,
		boardVal: packet.boardVal,
		queries: packet.queries,
		coords: packet.coords,
		line: packet.line,
		pts: packet.pts,
		elev: packet.elev,
		cum: packet.cum,
		totalWh: packet.totalWh,
		totalClimb: packet.totalClimb,
		usableWh: packet.usableWh,
		climbLimit: packet.climbLimit,
		brakeLimit: packet.brakeLimit,
		totalKm: packet.totalKm,
		verdictLevel: packet.verdict.level,
		drawn: packet.source === 'drawn' || undefined,
		recorded: packet.source === 'recorded' || undefined
	});

	startTracking();
	ui.setStatus('');
	ui.setTab('ride');
}

// Redraws a saved trip with zero network access — same rendering path a live
// plan uses, fed from stored data instead of fresh API responses.
export const loadTrip = (t: Trip): void => {
	if (!t.drawn && !t.recorded) {
		domain.stops = t.queries.map((q, i) => ({
			id: nextStopId(),
			value: q,
			coords: t.coords ? (t.coords[i] as LatLon) : null
		}));
		domain.activeStopIndex = 0;
	}
	if (MODES[t.modeId]) domain.selectMode(t.modeId);
	// Trust the trip's board only if the mode still ships it — otherwise the
	// chip row would highlight nothing while planning fell back silently.
	domain.boardVal =
		t.boardVal && (MODES[t.modeId]?.boards ?? domain.boards).some((b) => b.value === t.boardVal)
			? t.boardVal
			: domain.boards[0].value;

	const line = t.line as LatLon[];
	const pts = t.pts as LatLon[];
	const lineCum = cumulative(line);
	const segs = routeSegments(line, lineCum, pts, t.elev, t.cum);
	const mode = MODES[t.modeId] ?? domain.mode;
	const v = decide(segs, t.totalWh, t.usableWh, t.climbLimit, t.brakeLimit, mode);

	// Same session reset as a fresh plan — a loaded trip replaces the route.
	stopTracking();
	domain.applyResult({
		verdict: v,
		pts,
		elev: t.elev,
		cum: t.cum,
		totalWh: t.totalWh,
		totalClimb: t.totalClimb,
		usableWh: t.usableWh,
		mode,
		segs,
		line,
		coords: (t.coords ?? []) as LatLon[]
	});
	renderRoute(segs, line, (t.coords ?? []) as LatLon[], verdictHex(v.level));

	if (isMobileView()) ui.setSheet(true);
	ui.setStatus('Loaded from saved trips — no network used.');
	ui.setTab('ride');
};
export const scoreAndSaveCustomRoute = async (tapped: LatLon[], name: string, source: PlanSource) => {
	const boardVal = domain.boardVal || domain.boards[0].value;
	const modeId = domain.modeId;

	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		ui.setStatus(`You are offline — saving a ${source} route needs elevation data, but the traced points are kept.`, true);
		return;
	}
	// Drawn routes snap to the road network leg-by-leg — nobody rides
	// helicopter lines. Recordings skip this: GPS traces are the ridden path.
	let line = tapped;
	let snapNote: string | null = null;
	if (source === 'drawn') {
		ui.setStatus('Snapping your route to roads…');
		const snapped = await snapDrawnLine(tapped);
		line = snapped.line;
		if (snapped.straight > 0 && snapped.snapped > 0) {
			snapNote = `Snapped ${snapped.snapped} leg${snapped.snapped === 1 ? '' : 's'} to roads, kept ${snapped.straight} off-road section${snapped.straight === 1 ? '' : 's'} as tapped.`;
		} else if (snapped.straight > 0) {
			snapNote = 'No road match — kept your tapped line as-is.';
		}
	}
	if (snapNote) ui.setStatus(snapNote);
	ui.setStatus(`Fetching elevation for your ${source} route…`);
	try {
		if (line.length < 2) throw new Error('Need at least 2 points to score.');
		const pts = resample(line, RESAMPLE_STEP_M);
		const elev = await elevations(pts);
		const packet = buildPlanPacket({
			line,
			coords: [line[0], line[line.length - 1]],
			pts,
			elev,
			boardVal,
			modeId,
			queries: [name],
			source
		});
		finalisePlan(packet);
	} catch (err) {
		ui.setStatus(
			(err as Error).message ||
				`Could not process the ${source} route — elevation lookup still needs a connection.`,
			true
		);
	}
}

/* ---------- cloud backup ---------- */
// On first load: if the cloud has data and local is empty (fresh browser),
// restore it; otherwise push local up so new activity is mirrored. Runs once
// per session, quietly — this is backup, not a sync UI.
let backupInit = false;
export const initCloudBackup = async (): Promise<void> => {
	if (backupInit) return;
	backupInit = true;
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
	const remote = await fetchBackup();
	if (!remote) return; // offline or endpoints down — stay local-only
	if (remote.trips.length === 0 && remote.presets.length === 0) {
		if (domain.trips.length > 0 || domain.presets.length > 0) await pushBackup(domain.trips, domain.presets);
		return;
	}
	if (domain.trips.length === 0 && remote.trips.length > 0) {
		domain.trips = remote.trips.slice(0, TRIPS_MAX);
		saveTrips($state.snapshot(domain.trips));
	}
	if (domain.presets.length === 0 && remote.presets.length > 0) {
		domain.presets = remote.presets;
		savePresets($state.snapshot(domain.presets));
	}
};

/* ---------- custom route naming (injectable for tests) ---------- */
type RouteNamer = (message: string, defaultName: string) => string | null;
let routeNamer: RouteNamer = (message, defaultName) =>
	typeof window !== 'undefined' && typeof window.prompt === 'function'
		? window.prompt(message, defaultName)
		: defaultName;

export const setRouteNamer = (fn: RouteNamer): void => {
	routeNamer = fn;
};

export const askRouteName = (message: string, defaultName: string): string | null => {
	const name = routeNamer(message, defaultName);
	if (name == null) return null;
	const trimmed = name.trim();
	return trimmed || defaultName;
};

/* ---------- locate ---------- */
export const locateInto = (idx: number, panMap: boolean) => {
	const unavailable = !navigator.geolocation || !window.isSecureContext;
	if (unavailable) {
		ui.setStatus(
			window.isSecureContext
				? 'Geolocation is not available in this browser.'
				: 'Location needs a secure connection (https) — this works on the deployed site, or via a tunnel like `npx localtunnel` with an https URL.',
			true
		);
		return;
	}
	ui.setStatus('Finding your location…');
	navigator.geolocation.getCurrentPosition(
		async (pos) => {
			const { latitude, longitude, accuracy } = pos.coords;
			domain.setStopCoords(idx, [latitude, longitude]);

			if (panMap) {
				const { showLocateMarker } = await import('./mapController.svelte.js');
				showLocateMarker([latitude, longitude], accuracy);
			}

			try {
				domain.setStopValue(idx, await reverseGeocode(latitude, longitude), true);
			} catch {
				domain.setStopValue(idx, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, true);
			}

			const precision = accuracy != null ? `±${Math.round(accuracy)} m` : 'unknown precision';
			ui.setStatus(
				accuracy != null && accuracy > 200
					? `Located, but accuracy is low (${precision}) — check the pin/address before planning.`
					: `Located to ${precision}.`
			);
			const { saveKnownLocation } = await import('./storage.js');
			saveKnownLocation({ lat: latitude, lon: longitude, label: '', ts: Date.now() });
		},
		(err) => ui.setStatus(geoErrorMessage(err), true),
		{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
	);
}

// Quietly try to centre the map (and bias geocode()/autocompleteSearch()) on
// the user's actual location instead of the hardcoded Cape Town fallback.
// Failure (denied/unavailable) is silent: the app already works fine on the
// Cape Town default.
export const initMapCenter = (onCenter: (center: LatLon) => void) => {
	if (!navigator.geolocation) return;
	navigator.geolocation.getCurrentPosition(
		async (pos) => {
			const center: LatLon = [pos.coords.latitude, pos.coords.longitude];
			geoState.setCenter(center);
			const detected = await detectCountry(center);
			geoState.setCountry(detected);
			onCenter(center);
			const { saveKnownLocation } = await import('./storage.js');
			saveKnownLocation({ lat: center[0], lon: center[1], label: '', ts: Date.now() });
		},
		() => {
			// keep the Cape Town default (and its matching 'za' countryCode)
		},
		{ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
	);
};

/** Snap a single leg between two points to the road network. */
export async function snapDrawnLeg(
	a: LatLon,
	b: LatLon
): Promise<{ leg: LatLon[]; snapped: boolean }> {
	const straightLen = haversine(a, b);
	if (straightLen < 1) return { leg: [a], snapped: false }; // duplicate tap — nothing to add
	if (straightLen < RESAMPLE_STEP_M) return { leg: [a, b], snapped: false }; // too short — just add b

	try {
		const leg = await fetchRoute(a, b);
		const routed = cumulative(leg);
		const routedLen = routed[routed.length - 1];
		if (leg.length >= 2 && routedLen <= SNAP_FACTOR * straightLen) {
			return { leg, snapped: true };
		}
	} catch {
		// no road match – fall through to straight interpolation
	}

	// Straight interpolation at profiling resolution.
	const n = Math.max(1, Math.floor(straightLen / RESAMPLE_STEP_M));
	const straightLeg: LatLon[] = [a];
	for (let k = 1; k <= n; k++) {
		straightLeg.push([
			a[0] + ((b[0] - a[0]) * k) / n,
			a[1] + ((b[1] - a[1]) * k) / n
		]);
	}
	return { leg: straightLeg, snapped: false };
}

/** Snap a user-drawn polyline to the road network leg‑by‑leg.
 *  For each tapped segment we try `fetchRoute(a, b)`; if the routed length
 *  is not excessively longer than the straight-line distance we keep the
 *  road geometry, otherwise we fall back to evenly‑spaced interpolated
 *  way‑points at the profiling resolution.
 *
 *  Returns `{ line, snapped, straight }` where *snapped* is the count of
 *  legs that were road‑snapped and *straight* is the count kept as-tapped. */
export async function snapDrawnLine(
	tapped: LatLon[]
): Promise<{ line: LatLon[]; snapped: number; straight: number }> {
	const out: LatLon[] = [tapped[0]];
	let snapped = 0;
	let straight = 0;
	for (let i = 0; i < tapped.length - 1; i++) {
		const res = await snapDrawnLeg(tapped[i], tapped[i + 1]);
		if (res.snapped) snapped++;
		else straight++;
		out.push(...res.leg.slice(1));
	}
	return { line: out, snapped, straight };
}