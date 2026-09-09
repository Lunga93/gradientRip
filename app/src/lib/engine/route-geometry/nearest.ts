import { haversine } from './haversine.js';

/** Find nearest point on a polyline to a given lat/lon. */
export const nearestOnLine = (
	latlng: [number, number],
	line: [number, number][],
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