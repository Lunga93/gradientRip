// Typed geo gateway — remote query/command replacements for the old
// /api/* passthrough endpoints (deleted). Small idempotent reads are `query`
// (deduped + cached by arg, good for Nominatim quota); route legs and
// elevation batches are `command` (large payloads, never cached).
// Autocomplete keeps its /api/autocomplete endpoint: it needs AbortSignal
// cancellation, which remote functions don't thread through.
// Validation moved here from the deleted +server.ts files.

import { query, command } from '$app/server';
import { error } from '@sveltejs/kit';
import {
	geocode as svcGeocode,
	reverseGeocode as svcReverse,
	detectCountry as svcCountry,
	route as svcRoute,
	elevations as svcElevations
} from '$lib/server/services.js';
import type { LatLon } from '$lib/engine/index.js';

const isLatLon = (v: unknown): v is LatLon =>
	Array.isArray(v) &&
	v.length === 2 &&
	Number.isFinite(v[0]) &&
	Number.isFinite(v[1]) &&
	Math.abs(v[0]) <= 90 &&
	Math.abs(v[1]) <= 180;

const normCountry = (c: unknown): string =>
	typeof c === 'string' && /^[a-z]{2}$/i.test(c) ? c.toLowerCase() : 'za';

export const geocodeRemote = query(
	'unchecked',
	async (input: { query: string; country?: string }): Promise<LatLon> => {
		try {
			const q = (input.query || '').trim();
			if (!q) throw new Error('No query given.');
			if (q.length > 200) throw new Error('Query too long.');
			return await svcGeocode(q, normCountry(input.country));
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[geocodeRemote]', err);
			throw error(400, (err as Error).message || 'Geocoding failed');
		}
	}
);

export const reverseRemote = query(
	'unchecked',
	async (input: { lat: number; lon: number }): Promise<{ label: string }> => {
		try {
			const { lat, lon } = input;
			if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
				throw new Error('Bad coordinates.');
			}
			return { label: await svcReverse(lat, lon) };
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[reverseRemote]', err);
			throw error(400, (err as Error).message || 'Reverse geocoding failed');
		}
	}
);

export const countryRemote = query(
	'unchecked',
	async (input: { lat: number; lon: number }): Promise<{ country: string }> => {
		const { lat, lon } = input;
		if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
			return { country: 'za' };
		}
		return { country: await svcCountry([lat, lon]) };
	}
);

export const routeRemote = command(
	'unchecked',
	async (input: { a: LatLon; b: LatLon }): Promise<{ line: LatLon[] }> => {
		try {
			if (!isLatLon(input.a) || !isLatLon(input.b)) {
				throw new Error('Need two valid [lat, lon] endpoints.');
			}
			return { line: await svcRoute(input.a, input.b) };
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[routeRemote]', err);
			throw error(400, (err as Error).message || 'Routing failed');
		}
	}
);

export const elevationsRemote = command(
	'unchecked',
	async (input: { pts: LatLon[] }): Promise<{ elev: number[] }> => {
		try {
			const { pts } = input;
			if (!Array.isArray(pts) || pts.length < 2) throw new Error('Need at least 2 points.');
			if (pts.length > 2000) throw new Error('Too many points (max 2000).');
			if (!pts.every(isLatLon)) throw new Error('Invalid coordinates.');
			return { elev: await svcElevations(pts) };
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[elevationsRemote]', err);
			throw error(400, (err as Error).message || 'Elevation lookup failed');
		}
	}
);
