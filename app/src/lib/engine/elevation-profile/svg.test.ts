import { describe, it, expect } from 'vitest';
import { profileSVG } from './svg.js';

const lineExtent = (svg: string): number => {
	const m = svg.match(/<path d="([^"]+)" class="pline"/);
	const ys = [...(m?.[1] ?? '').matchAll(/[\d.]+ ([\d.]+)/g)].map((x) => Number(x[1]));
	return Math.max(...ys) - Math.min(...ys);
};

const rectCount = (svg: string): number => (svg.match(/<rect /g) ?? []).length;

describe('profileSVG grade strip', () => {
	it('merges a flat route into a single bar', () => {
		const pts = [0, 1, 2, 3, 4].map((i) => [0, i] as [number, number]);
		const chart = profileSVG(pts, [10, 10, 10, 10, 10], [0, 100, 200, 300, 400]);
		expect(rectCount(chart.svg)).toBe(1);
	});

	it('merges adjacent same-band segments (6 segs -> 3 rects)', () => {
		const pts = [0, 1, 2, 3, 4, 5, 6].map((i) => [0, i] as [number, number]);
		const chart = profileSVG(
			pts,
			[0, 30, 60, 90, 90, 90, 90],
			[0, 100, 200, 300, 400, 500, 600]
		);
		expect(rectCount(chart.svg)).toBe(3);
	});

	it('renders no in-SVG text — labels are HTML overlays', () => {
		const pts = [0, 1, 2].map((i) => [0, i] as [number, number]);
		const chart = profileSVG(pts, [10, 14, 12], [0, 500, 1000]);
		expect(chart.svg).not.toContain('<text');
	});
});

describe('profileSVG axis ticks', () => {
	const pts = [0, 1, 2, 3, 4].map((i) => [0, i] as [number, number]);

	it('emits positioned y + x ticks inside 0–100%', () => {
		const chart = profileSVG(pts, [10, 12, 14, 16, 18], [0, 250, 500, 750, 1000]);
		expect(chart.yTicks.length).toBeGreaterThanOrEqual(2);
		expect(chart.xTicks.length).toBeGreaterThanOrEqual(2);
		for (const t of [...chart.yTicks, ...chart.xTicks]) {
			expect(t.pct).toBeGreaterThanOrEqual(0);
			expect(t.pct).toBeLessThanOrEqual(100);
			expect(t.label.length).toBeGreaterThan(0);
		}
		expect(chart.xTicks[0].label).toBe('0');
	});

	it('labels the endpoint of short routes', () => {
		const chart = profileSVG(pts, [10, 10, 11, 11, 12], [0, 50, 100, 150, 200]);
		expect(chart.xTicks[chart.xTicks.length - 1].label).toBe('0.2 km');
	});
});

describe('profileSVG dynamic axis', () => {
	const pts = [0, 1, 2, 3, 4].map((i) => [0, i] as [number, number]);

	it('keeps a small axis for small relief (no 200 m axis for an 8 m bump)', () => {
		const chart = profileSVG(pts, [10, 12, 14, 16, 18], [0, 250, 500, 750, 1000], {
			climb: 30
		});
		const maxTick = Math.max(...chart.yTicks.map((t) => parseFloat(t.label)));
		expect(maxTick).toBeLessThanOrEqual(50);
	});

	it('opens up and differentiates rides as relief grows', () => {
		const elev = [0, 25, 50, 75, 100]; // 100 m span over 1 km
		const cum = [0, 250, 500, 750, 1000];
		const push = lineExtent(profileSVG(pts, elev, cum, { climb: 8 }).svg);
		const eskate = lineExtent(profileSVG(pts, elev, cum, { climb: 30 }).svg);
		expect(push).toBeGreaterThan(eskate);
	});

	it('falls back to the working-climb threshold without limits', () => {
		const elev = [10, 12, 14, 16, 18];
		const cum = [0, 250, 500, 750, 1000];
		const fallback = lineExtent(profileSVG(pts, elev, cum).svg);
		const explicit = lineExtent(profileSVG(pts, elev, cum, { climb: 12 }).svg);
		expect(fallback).toBeCloseTo(explicit, 6);
	});

	it('keeps the glowing accent line, never purple', () => {
		const svg = profileSVG(pts, [10, 12, 14, 16, 18], [0, 250, 500, 750, 1000], {
			climb: 30
		}).svg;
		expect(svg).toContain('stroke="var(--color-accent)"');
		expect(svg).not.toMatch(/7c3aed|8b5cf6|6d28d9/);
	});
});
