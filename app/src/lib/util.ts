// Geometry + misc helpers — ported verbatim from the legacy app.

export type LatLon = [number, number];

// Shared across tracker.ts and planner.svelte.ts — was duplicated in both.
export function geoErrorMessage(err: GeolocationPositionError): string {
	switch (err && err.code) {
		case 1: return 'Location permission denied — allow it for this site in your browser settings and try again.';
		case 2: return "Your device couldn't determine a position (no GPS/Wi-Fi fix available).";
		case 3: return 'Location request timed out — try again, ideally with a clearer view of the sky or on Wi-Fi.';
		default: return 'Could not get your location.';
	}
}

export function haversine(a: LatLon, b: LatLon): number {
	const R = 6371000;
	const [lat1, lon1] = a;
	const [lat2, lon2] = b;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(s));
}

// Walks the polyline emitting a point every `step` metres, carrying the
// remainder across vertices. Gaps are exactly `step` except the final
// remainder point at the end of the line.
export function resample(coords: LatLon[], step: number): LatLon[] {
	const out: LatLon[] = [coords[0]];
	let carry = 0;
	for (let i = 1; i < coords.length; i++) {
		const a = coords[i - 1];
		const b = coords[i];
		const segLen = haversine(a, b);
		let pos = carry;
		while (pos + step <= segLen) {
			pos += step;
			const t = pos / segLen;
			out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
		carry = segLen - pos;
	}
	const last = coords[coords.length - 1];
	const lastOut = out[out.length - 1];
	if (!lastOut || haversine(lastOut, last) > 1) out.push(last);
	return out;
}

export function cumulative(line: LatLon[]): number[] {
	const cum = [0];
	for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
	return cum;
}

// Progress is measured by nearest-vertex projection onto the full-resolution
// route line already used for the road-hugging map render, so it's consistent
// with what's drawn rather than a separate approximation.
export function nearestOnLine(
	latlng: LatLon,
	line: LatLon[],
	lineCum: number[]
): { distAlong: number; offRoute: number } {
	let bestI = 0;
	let bestD = Infinity;
	for (let i = 0; i < line.length; i++) {
		const d = haversine(latlng, line[i]);
		if (d < bestD) {
			bestD = d;
			bestI = i;
		}
	}
	return { distAlong: lineCum[bestI], offRoute: bestD };
}
