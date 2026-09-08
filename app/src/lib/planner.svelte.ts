// Plan pipeline — ported from the legacy submit handler and
// scoreAndSaveCustomRoute(). Geocode every stop in order (respecting
// Nominatim's 1 req/sec policy), route each leg, resample at 50 m, fetch
// elevation, integrate energy, verdict, render, save the trip.

import { MODES, NOMINATIM_DELAY_MS, RIDER_KIT_KG } from './modes.js';
import { geocode, route, elevations, setMapCenter } from './api.js';
import { resample, cumulative, haversine } from './util.js';
import type { LatLon } from './util.js';
import { segWh, routeSegments, verdictFor } from './scoring.js';
import { app } from './state/app.svelte.js';
import { renderRoute } from './mapController.svelte.js';
import { startTracking } from './tracker.js';
import { reverseGeocode, detectCountry, CT_CENTER } from './api.js';

export function isMobileView(): boolean {
	return window.matchMedia('(max-width:640px)').matches;
}

export async function planRoute(): Promise<void> {
	const btn = app.planning;
	if (btn) return;
	app.results = null;
	app.planning = true;

	try {
		const queries = app.stops.map((s) => s.value.trim());
		if (queries.length < 2 || queries.some((q) => !q)) {
			throw new Error('Every stop needs a place before you can plan the route.');
		}
		if (!navigator.onLine) {
			throw new Error(
				"You're offline — planning a new route needs a connection. Pick a saved trip below instead."
			);
		}
		const boardVal = app.boardVal || app.boards[0].value;
		const [, climbLimit, brakeLimit] = boardVal.split('|').map(Number);

		// Geocode every stop in order, respecting Nominatim's 1 req/sec policy —
		// except stops with an exact fix (from geolocation or a saved preset
		// captured from one), which skip text geocoding entirely and use that
		// fix directly.
		const coords: LatLon[] = [];
		for (let i = 0; i < queries.length; i++) {
			if (app.stops[i] && app.stops[i].coords) {
				coords.push(app.stops[i].coords as LatLon);
				continue;
			}
			app.setStatus(`Geocoding stop ${i + 1} of ${queries.length}…`);
			coords.push(await geocode(queries[i]));
			if (i < queries.length - 1) {
				await new Promise((r) => setTimeout(r, NOMINATIM_DELAY_MS));
			}
		}

		// Route each consecutive pair of stops and stitch the legs into one
		// continuous line, dropping a leg's duplicated first point.
		let line: LatLon[] = [];
		for (let i = 0; i < coords.length - 1; i++) {
			app.setStatus(`Fetching leg ${i + 1} of ${coords.length - 1}…`);
			const leg = await route(coords[i], coords[i + 1]);
			line = line.concat(line.length ? leg.slice(1) : leg);
		}

		app.setStatus('Resampling and fetching elevation…');
		const pts = resample(line, 50);
		const elev = await elevations(pts);
		finishScoring({
			line,
			coords,
			pts,
			elev,
			boardVal,
			climbLimit,
			brakeLimit,
			queries,
			source: 'planned'
		});
	} catch (err) {
		app.setStatus((err as Error).message || 'Something went wrong.', true);
	} finally {
		app.planning = false;
	}
}

// Shared by drawn routes (clicked points) and recorded routes (live GPS
// points) — both end up with nothing but an array of [lat, lon], and from
// there it's identical to scoring a computed route.
export async function scoreAndSaveCustomRoute(line: LatLon[], name: string, source: 'drawn' | 'recorded') {
	const boardVal = app.boardVal || app.boards[0].value;
	const [, climbLimit, brakeLimit] = boardVal.split('|').map(Number);

	app.setStatus(`Fetching elevation for your ${source} route…`);
	try {
		const pts = resample(line, 50);
		const elev = await elevations(pts);
		finishScoring({
			line,
			coords: [line[0], line[line.length - 1]],
			pts,
			elev,
			boardVal,
			climbLimit,
			brakeLimit,
			queries: [name],
			source
		});
	} catch (err) {
		app.setStatus(
			(err as Error).message ||
				`Could not process the ${source} route — elevation lookup still needs a connection.`,
			true
		);
	}
}

interface ScoreInput {
	line: LatLon[];
	coords: LatLon[];
	pts: LatLon[];
	elev: number[];
	boardVal: string;
	climbLimit: number;
	brakeLimit: number;
	queries: string[];
	source: 'planned' | 'drawn' | 'recorded';
}

function finishScoring(input: ScoreInput) {
	const { line, coords, pts, elev, boardVal, climbLimit, brakeLimit, queries, source } = input;
	const phys = MODES[app.modeId].phys;
	const usableWh = (app.boardVal || app.boards[0].value).split('|').map(Number)[0] * phys.usable;
	const mass = RIDER_KIT_KG + phys.vehicleKg;

	const cum: number[] = [0];
	for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));

	let totalWh = 0;
	let totalClimb = 0;
	for (let i = 1; i < pts.length; i++) {
		const d = cum[i] - cum[i - 1];
		const rise = elev[i] - elev[i - 1];
		const grade = rise / Math.max(1, d);
		totalWh += segWh(d, grade, mass);
		if (rise > 0) totalClimb += rise;
	}

	// Same colour-by-gradient road-hugging render a computed route gets —
	// routeSegments() doesn't know or care that `line` didn't come from OSRM.
	const lineCum = cumulative(line);
	const segs = routeSegments(line, lineCum, pts, elev, cum);
	const mode = MODES[app.modeId];
	const v = verdictFor(segs, totalWh, usableWh, climbLimit, brakeLimit, mode);

	app.applyResult({
		verdict: v,
		pts,
		elev,
		cum,
		totalWh,
		totalClimb,
		usableWh,
		mode,
		segs,
		line,
		coords
	});
	renderRoute(segs, line, coords);

	if (isMobileView()) app.setSheet(true);

	app.addTrip({
		ts: Date.now(),
		modeId: app.modeId,
		boardVal,
		queries,
		coords,
		line,
		pts,
		elev,
		cum,
		totalWh,
		totalClimb,
		usableWh,
		climbLimit,
		brakeLimit,
		totalKm: cum[cum.length - 1] / 1000,
		drawn: source === 'drawn' || undefined,
		recorded: source === 'recorded' || undefined
	});

	// A plan you just made is a plan you're about to ride — jump straight
	// into live tracking instead of making that a second click.
	startTracking();
	app.setStatus('');
}

/* ---------- locate ---------- */
export function geoErrorMessage(err: GeolocationPositionError): string {
	switch (err && err.code) {
		case 1:
			return 'Location permission denied — allow it for this site in your browser settings and try again.';
		case 2:
			return "Your device couldn't determine a position (no GPS/Wi-Fi fix available).";
		case 3:
			return 'Location request timed out — try again, ideally with a clearer view of the sky or on Wi-Fi.';
		default:
			return 'Could not get your location.';
	}
}

export function locateInto(idx: number, panMap: boolean) {
	if (!navigator.geolocation) {
		app.setStatus('Geolocation is not available in this browser.', true);
		return;
	}
	app.setStatus('Finding your location…');
	navigator.geolocation.getCurrentPosition(
		async (pos) => {
			const { latitude, longitude, accuracy } = pos.coords;
			// Store the exact fix — used directly at plan time instead of being
			// re-geocoded from text, which would throw away this precision.
			app.setStopCoords(idx, [latitude, longitude]);

			if (panMap) {
				const { showLocateMarker } = await import('./mapController.svelte.js');
				showLocateMarker([latitude, longitude], accuracy);
			}

			try {
				app.setStopValue(idx, await reverseGeocode(latitude, longitude));
			} catch {
				app.setStopValue(idx, `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
			}

			const precision = accuracy != null ? `±${Math.round(accuracy)} m` : 'unknown precision';
			app.setStatus(
				accuracy != null && accuracy > 200
					? `Located, but accuracy is low (${precision}) — check the pin/address before planning.`
					: `Located to ${precision}.`
			);
		},
		(err) => app.setStatus(geoErrorMessage(err), true),
		{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
	);
}

// Quietly try to centre the map (and bias geocode()/autocompleteSearch()) on
// the user's actual location instead of the hardcoded Cape Town fallback.
// Failure (denied/unavailable) is silent: the app already works fine on the
// Cape Town default.
export function initMapCenter(onCenter: (center: LatLon) => void) {
	if (!navigator.geolocation) return;
	navigator.geolocation.getCurrentPosition(
		(pos) => {
			const center: LatLon = [pos.coords.latitude, pos.coords.longitude];
			setMapCenter(center);
			detectCountry(center);
			onCenter(center);
		},
		() => {
			// keep the Cape Town default (and its matching 'za' countryCode)
		},
		{ enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
	);
}

export { CT_CENTER };
