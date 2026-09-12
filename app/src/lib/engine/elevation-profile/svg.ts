import type { LatLon } from '../plan-packet/types.js';
import { cssVar } from '../gradient-bands/css-vars.js';
import { THRESHOLDS } from '../gradient-bands/thresholds.js';
import { smooth5 } from './smooth.js';

export interface ProfileLimits {
	/** Board's rated max climb % — the chart fills as relief approaches it. */
	climb?: number;
}

export interface ProfileTick {
	/** Position in % of the chart box (top for y, left for x). */
	pct: number;
	label: string;
}

export interface ProfileChart {
	/** Inner SVG markup: gridlines, strip, fill, line. No text — labels are
	 * HTML overlays (see below) because preserveAspectRatio="none" would
	 * condense in-SVG glyphs ~3× horizontally into illegibility. */
	svg: string;
	yTicks: ProfileTick[];
	xTicks: ProfileTick[];
}

/**
 * Generate SVG for the elevation profile with grade-colored bars.
 *
 * Y-axis floats around the actual data with headroom (MapTiler
 * elevation-profile-control style), but the range is floored so the
 * geometry agrees with the verdict *for this ride*: the chart only fills
 * when the route's overall relief approaches the board's rated climb
 * limit — a 60 m route looks calm on an eskate (limit 30%) and serious
 * on a push skate (limit 8%). Same data, honest per-ride steepness.
 */
export const profileSVG = (
	pts: LatLon[],
	elev: number[],
	cum: number[],
	limits: ProfileLimits = {}
): ProfileChart => {
	const W = 900;
	const H = 200;
	const pad = 8; // labels live in HTML outside the SVG — pads stay minimal
	const minE = Math.min(...elev);
	const maxE = Math.max(...elev);
	const totalDist = cum[cum.length - 1] || 1;
	// Floor the range: 20% headroom, ≥50 m absolute, and ≥ the relief a
	// constant at-the-limit climb would produce over this distance.
	// Small relief stays a calm band in the middle instead of filling the chart.
	const climbPct =
		Number.isFinite(limits.climb) && (limits.climb as number) > 0
			? (limits.climb as number)
			: THRESHOLDS.workingClimb;
	const span = Math.max(maxE - minE, 0);
	// Dynamic axis: hug the data (span × 1.5, min 40 m) but never open wider
	// than this ride could plausibly produce (distance × its climb limit).
	// Small hills get small axes; the chart only fills as relief approaches
	// the board's limit — dramatic on a push skate long before an eskate.
	const ceiling = Math.max(totalDist * (climbPct / 100), 50);
	const range = Math.min(Math.max(span * 1.5, 40), ceiling);
	const mid = (maxE + minE) / 2;
	const lo = mid - range / 2;
	const hi = mid + range / 2;

	const x = (d: number) => pad + (d / totalDist) * (W - 2 * pad);
	const y = (e: number) => H - pad - ((e - lo) / range) * (H - 2 * pad);
	const baseY = H - pad;

	// Grade per segment (smoothed), mapped to band colors
	const rawGrades: number[] = [];
	for (let i = 1; i < pts.length; i++) {
		const d = Math.max(1, cum[i] - cum[i - 1]);
		const rise = elev[i] - elev[i - 1];
		rawGrades.push((rise / d) * 100);
	}
	const grades = smooth5(rawGrades);

	// Grade color strip anchored to the bottom. Adjacent segments sharing a
	// band merge into a single rect — long routes collapse hundreds of nodes
	// into a handful without changing a pixel.
	const stripH = (H - 2 * pad) * 0.3;
	const stripY = (baseY - stripH).toFixed(1);
	const stripDrawnH = stripH.toFixed(1);
	let bars = '';
	let runColor = '';
	let runX0 = 0;
	let runX1 = 0;
	const flushRun = (): void => {
		if (!runColor) return;
		bars += `<rect x="${runX0.toFixed(1)}" y="${stripY}" width="${Math.max(1, runX1 - runX0).toFixed(1)}" height="${stripDrawnH}" fill="${runColor}" opacity="0.45"/>`;
	};
	for (let i = 1; i < pts.length; i++) {
		const color = cssVar(grades[i - 1] ?? 0);
		const x0 = x(cum[i - 1]);
		const x1 = x(cum[i]);
		if (color === runColor) {
			runX1 = x1;
		} else {
			flushRun();
			runColor = color;
			runX0 = x0;
			runX1 = x1;
		}
	}
	flushRun();

	// Profile line + soft fill beneath it
	let line = `M ${x(cum[0]).toFixed(1)} ${y(elev[0]).toFixed(1)}`;
	for (let i = 1; i < pts.length; i++) {
		line += ` L ${x(cum[i]).toFixed(1)} ${y(elev[i]).toFixed(1)}`;
	}
	const fill = `${line} L ${x(totalDist).toFixed(1)} ${baseY} L ${x(0).toFixed(1)} ${baseY} Z`;

	// X-axis ticks (distance) — marks in SVG, labels as HTML overlay
	const distStep = Math.max(1, Math.ceil(totalDist / 1000 / 5)) * 1000; // ~5 ticks
	let xGrid = '';
	const xTicks: ProfileTick[] = [];
	let lastD = 0;
	for (let d = 0; d <= totalDist; d += distStep) {
		const xi = x(d);
		xGrid += `<line x1="${xi.toFixed(1)}" y1="${baseY}" x2="${xi.toFixed(1)}" y2="${baseY + 6}" stroke="var(--ink-3)" stroke-width="1.5"/>`;
		xTicks.push({ pct: (xi / W) * 100, label: d === 0 ? '0' : `${(d / 1000).toFixed(1)} km` });
		lastD = d;
	}
	// Short routes would otherwise end label-less — append the endpoint tick.
	// The edge labels are outside-aligned ("0" left, end right) so they only
	// risk colliding with a middle tick, never with each other.
	if (lastD === 0 || totalDist - lastD > distStep * 0.4) {
		const xi = x(totalDist);
		xGrid += `<line x1="${xi.toFixed(1)}" y1="${baseY}" x2="${xi.toFixed(1)}" y2="${baseY + 6}" stroke="var(--ink-3)" stroke-width="1.5"/>`;
		xTicks.push({ pct: (xi / W) * 100, label: `${(totalDist / 1000).toFixed(1)} km` });
	}

	// Y-axis ticks (elevation), rounded steps across the floored range
	const elevStep = Math.max(10, Math.round(range / 4 / 10) * 10);
	let yGrid = '';
	const yTicks: ProfileTick[] = [];
	const tickStart = minE >= 0 ? 0 : Math.ceil(lo / elevStep) * elevStep;
	for (let e = tickStart; e <= hi; e += elevStep) {
		const yi = y(e);
		yGrid += `<line x1="0" y1="${yi.toFixed(1)}" x2="${W}" y2="${yi.toFixed(1)}" stroke="var(--ink-3)" stroke-width="1.5" opacity="0.5"/>`;
		yTicks.push({ pct: (yi / H) * 100, label: `${Math.round(e)} m` });
	}

	return {
		svg: `
		${yGrid}${xGrid}
		${bars}
		<path d="${fill}" fill="var(--color-accent)" opacity="0.1"/>
		<path d="${line}" class="pline" fill="none" stroke="var(--color-accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
	`,
		yTicks,
		xTicks
	};
};
