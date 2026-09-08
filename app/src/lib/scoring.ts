// Physics + gradient scoring — ported verbatim from the legacy app.
// Do not "simplify" this. The numbers were validated by hand against an
// independent calculation before the code was written (see SPEC.md).

import { G, RHO, MODES } from './modes.js';
import type { Mode } from './modes.js';
import type { LatLon } from './util.js';

// distance in metres, grade as a fraction (0.06 = 6%), v in km/h.
// P defaults to the active transport mode's tuning; explicit vKmh keeps the
// SPEC.md regression cases callable (e.g. segWh(1000, 0, 116.8, 25)).
export function segWh(distance: number, grade: number, mass: number, vKmh?: number, P?: Mode['phys']): number {
	const p = P || MODES.eskate.phys;
	const v = (vKmh == null ? p.speed : vKmh) / 3.6;
	const fRoll = p.crr * mass * G;
	const fAir = 0.5 * RHO * p.cda * v * v;
	const fGrav = mass * G * Math.sin(Math.atan(grade));
	const f = Math.max(0, fRoll + fAir + fGrav); // clamped: no regen credited
	return (f * distance) / p.eff / 3600;
}

/* ---------- gradient bands (deliberately asymmetric — see SPEC.md) ---------- */
export interface Band {
	c: string;
	k: string;
}

export function band(gradePct: number): Band {
	const g = gradePct;
	if (g <= -12) return { c: '#4a1420', k: 'past braking' };
	if (g <= -8) return { c: '#b5502e', k: 'steep descent' };
	if (g <= -4) return { c: '#c98a2c', k: 'watch your speed' };
	if (g < 4) return { c: '#6b8f4e', k: 'easy going' };
	if (g < 10) return { c: '#8fae7a', k: 'working climb' };
	if (g < 15) return { c: '#c98a2c', k: 'hard climb' };
	return { c: '#b5502e', k: 'at the motor limit' };
}

export function smooth3(arr: number[]): number[] {
	if (arr.length < 3) return arr.slice();
	const out = arr.slice();
	for (let i = 1; i < arr.length - 1; i++) {
		out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3;
	}
	return out;
}

/* ---------- profile SVG ---------- */
export function profileSVG(pts: LatLon[], elev: number[], cum: number[]): string {
	const W = 900;
	const H = 180;
	const pad = 4;
	const minE = Math.min(...elev);
	const maxE = Math.max(...elev);
	const range = Math.max(1, maxE - minE);
	const totalDist = cum[cum.length - 1] || 1;

	const x = (d: number) => pad + (d / totalDist) * (W - 2 * pad);
	const y = (e: number) => H - pad - ((e - minE) / range) * (H - 2 * pad);

	let bars = '';
	for (let i = 1; i < pts.length; i++) {
		const grade = ((elev[i] - elev[i - 1]) / Math.max(1, cum[i] - cum[i - 1])) * 100;
		const { c } = band(grade);
		const x0 = x(cum[i - 1]);
		const x1 = x(cum[i]);
		bars += `<rect x="${x0.toFixed(1)}" y="0" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${H}" fill="${c}" opacity="0.35"/>`;
	}

	let line = `M ${x(cum[0]).toFixed(1)} ${y(elev[0]).toFixed(1)}`;
	for (let i = 1; i < pts.length; i++) {
		line += ` L ${x(cum[i]).toFixed(1)} ${y(elev[i]).toFixed(1)}`;
	}

	return `${bars}<path d="${line}" fill="none" stroke="#edf2ef" stroke-width="2"/>`;
}

/* ---------- gradient -> route colouring on the map ----------
   The map must hug the actual road geometry, not the coarser 50 m sample
   points used for elevation. So we colour every sub-segment of the
   full-resolution route line, looking up its grade by binary-searching the
   distance-along-route into the resampled elevation profile. */
export function gradeAt(dist: number, cum: number[], elev: number[]): number {
	// binary search for the bracket [cum[i-1], cum[i]] containing `dist`
	let lo = 1;
	let hi = cum.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (cum[mid] < dist) lo = mid + 1;
		else hi = mid;
	}
	const i = Math.min(lo, cum.length - 1);
	const d = Math.max(1, cum[i] - cum[i - 1]);
	return ((elev[i] - elev[i - 1]) / d) * 100;
}

export interface RouteSegment {
	a: LatLon;
	b: LatLon;
	c: string;
	k: string;
	grade: number;
}

export function routeSegments(
	line: LatLon[],
	lineCum: number[],
	pts: LatLon[],
	elev: number[],
	cum: number[]
): RouteSegment[] {
	const segs: RouteSegment[] = [];
	for (let i = 1; i < line.length; i++) {
		const mid = (lineCum[i - 1] + lineCum[i]) / 2;
		const grade = gradeAt(mid, cum, elev);
		segs.push({ a: line[i - 1], b: line[i], ...band(grade), grade });
	}
	return segs;
}

/* ---------- verdict ---------- */
export interface Verdict {
	level: 'ok' | 'caution' | 'stop';
	badge: string;
	text: string;
}

export function verdictFor(
	segs: RouteSegment[],
	totalWh: number,
	usableWh: number,
	climbLimit: number,
	brakeLimit: number,
	mode: Mode
): Verdict {
	const m = mode;
	const worstDescent = Math.min(0, ...segs.map((s) => s.grade));
	const worstClimb = Math.max(0, ...segs.map((s) => s.grade));
	const kcal = (wh: number) => (wh * 0.86).toFixed(0);

	if (Math.abs(worstDescent) >= brakeLimit) {
		return {
			level: 'stop',
			badge: 'Stop',
			text: `This route drops at up to ${Math.abs(worstDescent).toFixed(0)}%, past this ${m.unit}'s ${brakeLimit}% braking limit. ${m.brakeNote}`
		};
	}
	if (totalWh > usableWh) {
		return {
			level: 'stop',
			badge: 'Stop',
			text: m.human
				? `Estimated effort (${kcal(totalWh)} kcal) is beyond a comfortable day's output (${kcal(usableWh)} kcal). Shorten the route or plan a proper food stop.`
				: `Estimated energy use (${totalWh.toFixed(0)} Wh) exceeds this ${m.unit}'s usable capacity (${usableWh.toFixed(0)} Wh). You will not make this distance on one charge.`
		};
	}
	if (worstClimb >= climbLimit) {
		return {
			level: 'caution',
			badge: 'Caution',
			text: `Peak climb of ${worstClimb.toFixed(0)}% is at or beyond this ${m.unit}'s rated climb limit (${climbLimit}%). ${m.climbNote}`
		};
	}
	if (totalWh > usableWh * 0.7) {
		return {
			level: 'caution',
			badge: 'Caution',
			text: m.human
				? `This route burns ${(totalWh / usableWh * 100).toFixed(0)}% of a comfortable day's effort one way. Fine as a single leg, heavy as a round trip.`
				: `This route uses ${(totalWh / usableWh * 100).toFixed(0)}% of usable battery one way. Fine for a single leg, tight for a round trip without charging in between.`
		};
	}
	return {
		level: 'ok',
		badge: 'OK',
		text: m.human
			? `Comfortably within a day's effort and within this ${m.unit}'s climb and braking limits — ${kcal(totalWh)} kcal, ${(totalWh / usableWh * 100).toFixed(0)}% of the day's budget.`
			: `Comfortably within range and within this ${m.unit}'s climb and braking limits — ${totalWh.toFixed(0)} Wh, ${(totalWh / usableWh * 100).toFixed(0)}% of usable battery.`
	};
}

// Merge consecutive same-colour segments into one polyline each — the
// underlying points still trace every vertex of the full-resolution route,
// so the line hugs the road exactly, but we don't create one DOM element
// per OSRM vertex (a few km of route can be 1000+ points).
export function mergePolylines(segs: RouteSegment[]): { c: string; pts: LatLon[] }[] {
	const groups: { c: string; pts: LatLon[] }[] = [];
	let cur: { c: string; pts: LatLon[] } | null = null;
	for (const s of segs) {
		if (!cur || cur.c !== s.c) {
			if (cur) groups.push(cur);
			cur = { c: s.c, pts: [s.a, s.b] };
		} else {
			cur.pts.push(s.b);
		}
	}
	if (cur) groups.push(cur);
	return groups;
}
