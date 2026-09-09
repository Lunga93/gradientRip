import type { LatLon } from '../util.js';
import { haversine } from '../util.js';

const UA = 'gradient-route-planner/1.0 (personal use)';
const NOMINATIM_HEADERS = { 'User-Agent': UA, 'Accept-Language': 'en' };
const JSON_HEADERS = { 'User-Agent': UA, Accept: 'application/json' };

export const detectCountry = async (center: LatLon): Promise<string> => {
	try {
		const [lat, lon] = center;
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=3`;
		const resp = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(10000) });
		if (!resp.ok) return 'za';
		const data = await resp.json();
		return data.address?.country_code?.toLowerCase() ?? 'za';
	} catch {
		return 'za';
	}
}

export const geocode = async (query: string, country = 'za'): Promise<LatLon> => {
	const attempts = [query, stripHouseNumber(query), stripTrailingLocality(query)];
	for (const q of [...new Set(attempts)]) {
		if (!q) continue;
		const url =
			`https://nominatim.openstreetmap.org/search?format=json&limit=1` +
			`&countrycodes=${country}&q=${encodeURIComponent(q)}`;
		const resp = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(10000) });
		if (!resp.ok) throw new Error('Geocoding failed');
		const data: { lat: string; lon: string }[] = await resp.json();
		if (data.length) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
	}
	throw new Error(`Could not find "${query}"`);
}

const stripHouseNumber = (query: string): string => query.replace(/^\s*[0-9]{1,6}\b\s*/, '').trim();

const stripTrailingLocality = (query: string): string => {
	const trimmed = query.trim();
	const comma = trimmed.lastIndexOf(',');
	return comma > 0 ? trimmed.slice(0, comma).trim() : '';
};

export const reverseGeocode = async (lat: number, lon: number): Promise<string> => {
	const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
	const resp = await fetch(url, { headers: NOMINATIM_HEADERS, signal: AbortSignal.timeout(10000) });
	if (!resp.ok) throw new Error('Reverse geocoding failed');
	const data = await resp.json();
	return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

interface PhotonFeature {
	properties: {
		name?: string;
		housenumber?: string;
		street?: string;
		city?: string;
		district?: string;
		county?: string;
		state?: string;
		countrycode?: string;
	};
	geometry: { coordinates: [number, number] };
}

const photonLabel = (p: PhotonFeature['properties']): string => {
	const parts: string[] = [p.name ?? ''];
	if (p.housenumber && p.street) parts.push(`${p.street} ${p.housenumber}`);
	else if (p.street) parts.push(p.street);
	const locality = p.city || p.district || p.county;
	if (locality && locality !== p.name) parts.push(locality);
	if (p.state) parts.push(p.state);
	return parts.filter(Boolean).join(', ');
};

type PhotonResult = { label: string; lat: number; lon: number };
const streetQuery = (query: string): string => stripHouseNumber(query).split(',')[0].trim();
const hasFeature = (f: PhotonFeature): boolean => !!(f.properties.name || f.properties.street);
const inCountry =
	(country: string) =>
	(f: PhotonFeature): boolean =>
		!country || (f.properties.countrycode || '').toLowerCase() === country;
const toResult = (f: PhotonFeature): PhotonResult => ({
	label: photonLabel(f.properties),
	lat: f.geometry.coordinates[1],
	lon: f.geometry.coordinates[0]
});

const photonSearch = async (
	rawQuery: string,
	lat: number,
	lon: number,
	country: string
): Promise<PhotonResult[]> => {
	const url = `https://photon.komoot.io/api/?limit=8&lat=${lat}&lon=${lon}&q=${encodeURIComponent(rawQuery)}`;
	const resp = await fetch(url, { headers: JSON_HEADERS, signal: AbortSignal.timeout(8000) });
	if (!resp.ok) throw new Error('Autocomplete lookup failed');
	const data = (await resp.json()) as { features: PhotonFeature[] };
	return data.features.filter(hasFeature).filter(inCountry(country)).slice(0, 5).map(toResult);
};

const CLOSE_KM = 60;
const nearBias = (r: PhotonResult, lat: number, lon: number): boolean =>
	haversine([lat, lon], [r.lat, r.lon]) <= CLOSE_KM * 1000;

export const autocompleteSearch = async (
	query: string,
	lat: number,
	lon: number,
	country = 'za'
): Promise<PhotonResult[]> => {
	const exact = await photonSearch(query, lat, lon, country);
	if (exact.length) {
		if (!query.trim().match(/[0-9]/)) return exact;
		const close = exact.filter((r) => nearBias(r, lat, lon));
		if (close.length) return close;
	}
	const street = streetQuery(query);
	if (street && street !== query) {
		const sc = await photonSearch(street, lat, lon, country);
		const close = sc.filter((r) => nearBias(r, lat, lon));
		if (close.length) return close;
		return sc;
	}
	return exact;
};

export const route = async (a: LatLon, b: LatLon): Promise<LatLon[]> => {
	const coordStr = `${a[1]},${a[0]};${b[1]},${b[0]}`;
	try {
		const url = `https://routing.openstreetmap.de/routed-bike/route/v1/bike/${coordStr}?overview=full&geometries=geojson`;
		const resp = await fetch(url, { headers: JSON_HEADERS, signal: AbortSignal.timeout(15000) });
		if (!resp.ok) throw new Error('primary router failed');
		const data = await resp.json();
		if (!data.routes || !data.routes.length) throw new Error('no route');
		return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
	} catch (primaryErr) {
		try {
			const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
			const resp = await fetch(url, { headers: JSON_HEADERS, signal: AbortSignal.timeout(15000) });
			if (!resp.ok) throw new Error('Routing failed (both primary and fallback)', { cause: primaryErr });
			const data = await resp.json();
			if (!data.routes || !data.routes.length) throw new Error('No route found', { cause: primaryErr });
			return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
		} catch (fallbackErr) {
			if (fallbackErr instanceof Error && fallbackErr.cause === primaryErr) throw fallbackErr;
			throw new Error((primaryErr as Error)?.message || 'Routing failed', { cause: fallbackErr });
		}
	}
}

export const elevations = async (pts: LatLon[]): Promise<number[]> => {
	// Chunks are independent idempotent reads — up to 4 in flight at a time.
	// Order is preserved by writing each chunk into its own slot.
	const CHUNK = 100;
	const CONCURRENCY = 4;
	const out: number[][] = [];
	for (let i = 0; i < pts.length; i += CHUNK) out.push([]);
	const fetchChunk = async (start: number, slot: number): Promise<void> => {
		const chunk = pts.slice(start, start + CHUNK);
		const lats = chunk.map((p) => p[0].toFixed(6)).join(',');
		const lons = chunk.map((p) => p[1].toFixed(6)).join(',');
		const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
		const resp = await fetch(url, { headers: JSON_HEADERS, signal: AbortSignal.timeout(15000) });
		if (!resp.ok) throw new Error('Elevation lookup failed');
		const data = await resp.json();
		if (!Array.isArray(data.elevation) || data.elevation.length !== chunk.length) {
			throw new Error('Elevation lookup returned mismatched data');
		}
		out[slot] = data.elevation;
	};
	for (let i = 0; i < pts.length; i += CHUNK * CONCURRENCY) {
		const jobs: Promise<void>[] = [];
		for (let j = 0; j < CONCURRENCY && i + j * CHUNK < pts.length; j++) {
			jobs.push(fetchChunk(i + j * CHUNK, i / CHUNK + j));
		}
		await Promise.all(jobs);
	}
	return out.flat();
}