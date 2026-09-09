import type { LatLon } from '../plan-packet/types.js';
import { cssVar } from '../gradient-bands/css-vars.js';
import { smooth5 } from './smooth.js';

/** Generate SVG for the elevation profile with gradient-colored bars. */
export const profileSVG = (pts: LatLon[], elev: number[], cum: number[]): string => {
	const W = 900;
	const H = 180;
	const pad = 40; // increased for axis labels
	const minE = Math.min(...elev);
	const maxE = Math.max(...elev);
	const rawRange = Math.max(1, maxE - minE);
	const range = Math.max(rawRange, 50);
	const totalDist = cum[cum.length - 1] || 1;

	const x = (d: number) => pad + (d / totalDist) * (W - 2 * pad);
	const y = (e: number) => H - pad - ((e - minE) / range) * (H - 2 * pad);

	const rawGrades: number[] = [];
	for (let i = 1; i < pts.length; i++) {
		const d = Math.max(1, cum[i] - cum[i - 1]);
		const rise = elev[i] - elev[i - 1];
		rawGrades.push((rise / d) * 100);
	}
	const grades = smooth5(rawGrades);

	let bars = '';
	for (let i = 1; i < pts.length; i++) {
		const color = cssVar(grades[i - 1] ?? 0);
		const x0 = x(cum[i - 1]);
		const x1 = x(cum[i]);
		bars += `<rect x="${x0.toFixed(1)}" y="${y(maxE)}" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${H - pad - y(maxE)}" fill="${color}" opacity="0.35"/>`;
	}

	let line = `M ${x(cum[0]).toFixed(1)} ${y(elev[0]).toFixed(1)}`;
	for (let i = 1; i < pts.length; i++) {
		line += ` L ${x(cum[i]).toFixed(1)} ${y(elev[i]).toFixed(1)}`;
	}

	// X-axis ticks (distance)
	const distStep = Math.max(1, Math.ceil(totalDist / 1000 / 5)) * 1000; // ~5 ticks
	let xAxis = '';
	for (let d = 0; d <= totalDist; d += distStep) {
		const xi = x(d);
		const label = d === 0 ? '0' : `${(d / 1000).toFixed(1)} km`;
		xAxis += `<line x1="${xi.toFixed(1)}" y1="${H - pad}" x2="${xi.toFixed(1)}" y2="${H - pad + 4}" stroke="#666" stroke-width="1"/>`;
		xAxis += `<text x="${xi.toFixed(1)}" y="${H - pad + 14}" font-size="9" fill="#666" text-anchor="middle">${label}</text>`;
	}

	// Y-axis ticks (elevation)
	const elevStep = Math.max(10, Math.ceil(range / 100) * 50); // ~50m steps
	let yAxis = '';
	for (let e = minE; e <= maxE; e += elevStep) {
		const yi = y(e);
		yAxis += `<line x1="${pad - 4}" y1="${yi.toFixed(1)}" x2="${pad}" y2="${yi.toFixed(1)}" stroke="#666" stroke-width="1"/>`;
		yAxis += `<text x="${pad - 6}" y="${yi.toFixed(1)}" font-size="9" fill="#666" text-anchor="end" dominant-baseline="middle">${Math.round(e)} m</text>`;
	}

	return `
		<g font-family="system-ui, sans-serif">${xAxis}${yAxis}</g>
		${bars}
		<path d="${line}" fill="none" stroke="var(--profile-line, #171a1f)" stroke-width="2"/>
	`;
};