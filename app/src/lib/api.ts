// Browser gateway for geo services. Thin typed wrappers over the remote
// functions in geo.remote.ts — no manual fetch/JSON except autocomplete,
// which keeps its /api/autocomplete endpoint for AbortSignal cancellation.
import type { LatLon } from './util.js';
import { geoState, DEFAULT_CENTER } from './geo-state.svelte.js';
import {
	geocodeRemote,
	reverseRemote,
	countryRemote,
	routeRemote,
	elevationsRemote
} from './geo.remote.js';

export { DEFAULT_CENTER };

// Remote failures arrive as HttpError with the message on body.message;
// surface a plain Error so callers keep one error shape.
const unwrap = (err: unknown, fallback: string): Error => {
	const msg =
		(err as { body?: { message?: string }; message?: string })?.body?.message ??
		(err as Error)?.message ??
		fallback;
	return new Error(msg);
};

const qs = (params: Record<string, string | number | undefined>) => {
	const s = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v != null && v !== '') s.set(k, String(v));
	return s.toString();
};

export const detectCountry = async (center: LatLon): Promise<string> => {
	try {
		const [lat, lon] = center;
		const { country } = await countryRemote({ lat, lon });
		return (country || 'za').toLowerCase();
	} catch {
		return 'za';
	}
};

export const geocode = async (query: string, country: string = geoState.country): Promise<LatLon> => {
	try {
		return await geocodeRemote({ query, country });
	} catch (err) {
		throw unwrap(err, 'Geocoding failed');
	}
};

export const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
	try {
		const { label } = await reverseRemote({ lat, lon });
		return label;
	} catch (err) {
		throw unwrap(err, 'Reverse geocoding failed');
	}
};

export const autocompleteSearch = async (
	query: string,
	signal: AbortSignal,
	center: LatLon = geoState.center,
	country: string = geoState.country
): Promise<{ label: string; lat: number; lon: number }[]> => {
	const [lat, lon] = center;
	const resp = await fetch(`/api/autocomplete?${qs({ q: query, lat, lon, country })}`, { signal });
	if (!resp.ok) throw new Error('Autocomplete lookup failed');
	return (await resp.json()) as { label: string; lat: number; lon: number }[];
};

export const route = async (a: LatLon, b: LatLon): Promise<LatLon[]> => {
	try {
		const { line } = await routeRemote({ a, b });
		return line;
	} catch (err) {
		throw unwrap(err, 'Routing failed');
	}
};

export const elevations = async (pts: LatLon[]): Promise<number[]> => {
	try {
		const { elev } = await elevationsRemote({ pts });
		return elev;
	} catch (err) {
		throw unwrap(err, 'Elevation lookup failed');
	}
};
