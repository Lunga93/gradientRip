import { haversine } from './haversine.js';

export const RESAMPLE_STEP_M = 50;

/** Resample a polyline to points every `step` meters. */
export const resample = (coords: [number, number][], step: number): [number, number][] => {
	const out: [number, number][] = [coords[0]];
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