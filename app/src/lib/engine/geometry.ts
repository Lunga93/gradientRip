// Pure route geometry — no I/O, no framework. Shared by the scoring engine,
// the server plan pipeline and the GPS session code. Lives in the engine
// package so the engine is self-contained; $lib/util.js re-exports it for
// the UI/session modules.

export type LatLon = [number, number];

/** Resample step for elevation profiling — shared by server plan + client draw/record. */
export const RESAMPLE_STEP_M = 50;

export const haversine = (a: LatLon, b: LatLon): number => {
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
};

export const resample = (coords: LatLon[], step: number): LatLon[] => {
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
};

export const cumulative = (line: LatLon[]): number[] => {
	const cum = [0];
	for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
	return cum;
};

export const nearestOnLine = (
	latlng: LatLon,
	line: LatLon[],
	lineCum: number[]
): { distAlong: number; offRoute: number } => {
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
};
