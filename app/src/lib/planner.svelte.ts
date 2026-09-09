import { MODES } from './engine/modes.js';
import { elevations, reverseGeocode, detectCountry } from './api.js';
import { geoState } from './geo-state.svelte.js';
import { resample, geoErrorMessage, RESAMPLE_STEP_M, cumulative } from './util.js';
import type { LatLon } from './util.js';
import { domain } from './state/domain.svelte.js';
import { ui } from './state/ui.svelte.js';
import { session } from './state/session.svelte.js';
import { nextStopId } from './state/domain.svelte.js';
import { renderRoute } from './mapController.svelte.js';
import { startTracking, stopTracking } from './tracker.js';
import { buildPlanPacket } from './engine/planCore.js';
import { routeSegments, verdictFor } from './engine/scoring.js';
import { planRoute } from './plan.remote.js';
import type { PlanPacket, PlanSource } from './engine/planShared.js';
import type { Trip } from './storage.js';

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
	renderRoute(packet.segs, packet.line, packet.coords);

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
	const v = verdictFor(segs, t.totalWh, t.usableWh, t.climbLimit, t.brakeLimit, mode);

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
	renderRoute(segs, line, (t.coords ?? []) as LatLon[]);

	if (isMobileView()) ui.setSheet(true);
	ui.setStatus('Loaded from saved trips — no network used.');
	ui.setTab('ride');
};
export const scoreAndSaveCustomRoute = async (line: LatLon[], name: string, source: PlanSource) => {
	const boardVal = domain.boardVal || domain.boards[0].value;
	const modeId = domain.modeId;

	if (typeof navigator !== 'undefined' && !navigator.onLine) {
		ui.setStatus(`You are offline — saving a ${source} route needs elevation data, but the traced points are kept.`, true);
		return;
	}
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
}