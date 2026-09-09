import type { LatLon } from '../plan-packet/types.js';
import { cssVar } from '../gradient-bands/css-vars.js';

/** Generate SVG for the elevation profile with gradient-colored bars. */
export const profileSVG = (pts: LatLon[], elev: number[], cum: number[]): string => {
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
		const color = cssVar(grade);
		const x0 = x(cum[i - 1]);
		const x1 = x(cum[i]);
		bars += `<rect x="${x0.toFixed(1)}" y="0" width="${Math.max(1, x1 - x0).toFixed(1)}" height="${H}" fill="${color}" opacity="0.35"/>`;
	}

	let line = `M ${x(cum[0]).toFixed(1)} ${y(elev[0]).toFixed(1)}`;
	for (let i = 1; i < pts.length; i++) {
		line += ` L ${x(cum[i]).toFixed(1)} ${y(elev[i]).toFixed(1)}`;
	}

	return `${bars}<path d="${line}" fill="none" stroke="var(--profile-line, #171a1f)" stroke-width="2"/>`;
};