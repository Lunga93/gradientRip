// External service calls — ported verbatim from the legacy app.
// Same endpoints, same delays, same country filtering.

import type { LatLon } from './util.js';

// Where the map opens and what geocode()/autocompleteSearch() bias toward.
// Fallback only — used until/unless geolocation resolves (see initMapCenter()).
export const CT_CENTER: LatLon = [-33.9249, 18.4241];

export let mapCenter: LatLon = CT_CENTER;
export let countryCode = 'za';

export function setMapCenter(center: LatLon): void {
	mapCenter = center;
}

/* Geocoding is bound to the user's whole country, not a small box around
   them — a rectangular box around mapCenter would cut off results near the
   edges of a big country, or near a national border pull in a neighbouring
   one. countrycodes is a proper administrative-boundary filter, not a
   rectangle. countryCode defaults to 'za' (matching the CT_CENTER fallback)
   and is replaced by detectCountry() once the user's real location resolves. */
export async function detectCountry(center: LatLon): Promise<void> {
	try {
		const [lat, lon] = center;
		// zoom=3 asks Nominatim for country-level detail only — lighter and
		// faster than a full address reverse-lookup, since that's all this needs.
		const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&zoom=3`;
		const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
		if (!resp.ok) return;
		const data = await resp.json();
		if (data.address && data.address.country_code) {
			countryCode = data.address.country_code.toLowerCase();
		}
	} catch {
		// keep whatever countryCode we already had
	}
}

export async function geocode(query: string): Promise<LatLon> {
	const url =
		`https://nominatim.openstreetmap.org/search?format=json&limit=1` +
		`&countrycodes=${countryCode}&q=${encodeURIComponent(query)}`;
	const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
	if (!resp.ok) throw new Error('Geocoding failed');
	const data = await resp.json();
	if (!data.length) throw new Error(`Could not find "${query}"`);
	return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
	const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`;
	const resp = await fetch(url, { headers: { 'Accept-Language': 'en' } });
	if (!resp.ok) throw new Error('Reverse geocoding failed');
	const data = await resp.json();
	return data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

// Type-ahead suggestions via Photon (photon.komoot.io) — free, keyless,
// CORS-open, and unlike Nominatim's /search (used for geocode() above) it
// does real prefix matching. Each result carries its own lat/lon, so picking
// one sets an exact coords fix on the stop (same mechanism as
// geolocation/presets) — no fuzzy re-geocoding of typed text at plan time.
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

function photonLabel(p: PhotonFeature['properties']): string {
	const parts: string[] = [p.name ?? ''];
	if (p.housenumber && p.street) parts.push(`${p.street} ${p.housenumber}`);
	else if (p.street) parts.push(p.street);
	const locality = p.city || p.district || p.county;
	if (locality && locality !== p.name) parts.push(locality);
	if (p.state) parts.push(p.state);
	return parts.filter(Boolean).join(', ');
}

// Photon has no countrycodes-style param, so country-wide bounding is a
// client-side filter instead of a query param — each feature already
// carries its own properties.countrycode. lat/lon stays as a soft
// ranking bias within the country (nearer results first), not a hard box.
export async function autocompleteSearch(
	query: string,
	signal: AbortSignal
): Promise<{ label: string; lat: number; lon: number }[]> {
	const [lat, lon] = mapCenter;
	const url = `https://photon.komoot.io/api/?limit=8&lat=${lat}&lon=${lon}&q=${encodeURIComponent(query)}`;
	const resp = await fetch(url, { signal });
	if (!resp.ok) throw new Error('Autocomplete lookup failed');
	const data = await resp.json();
	return (data.features as PhotonFeature[])
		.filter((f) => f.properties.name) // unnamed features (bare address points) make poor suggestions
		.filter((f) => !countryCode || (f.properties.countrycode || '').toLowerCase() === countryCode)
		.slice(0, 5)
		.map((f) => ({
			label: photonLabel(f.properties),
			lat: f.geometry.coordinates[1],
			lon: f.geometry.coordinates[0]
		}));
}

export async function route(a: LatLon, b: LatLon): Promise<LatLon[]> {
	const coordStr = `${a[1]},${a[0]};${b[1]},${b[0]}`;
	try {
		const url = `https://routing.openstreetmap.de/routed-bike/route/v1/bike/${coordStr}?overview=full&geometries=geojson`;
		const resp = await fetch(url);
		if (!resp.ok) throw new Error('primary router failed');
		const data = await resp.json();
		if (!data.routes || !data.routes.length) throw new Error('no route');
		return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
	} catch {
		const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;
		const resp = await fetch(url);
		if (!resp.ok) throw new Error('Routing failed (both primary and fallback)');
		const data = await resp.json();
		if (!data.routes || !data.routes.length) throw new Error('No route found');
		return data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon]);
	}
}

export async function elevations(pts: LatLon[]): Promise<number[]> {
	const out: number[] = [];
	for (let i = 0; i < pts.length; i += 100) {
		const chunk = pts.slice(i, i + 100);
		const lats = chunk.map((p) => p[0].toFixed(6)).join(',');
		const lons = chunk.map((p) => p[1].toFixed(6)).join(',');
		const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
		const resp = await fetch(url);
		if (!resp.ok) throw new Error('Elevation lookup failed');
		const data = await resp.json();
		out.push(...data.elevation);
	}
	return out;
}
