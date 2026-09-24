import { describe, expect, it } from 'vitest';
import { offsetStart, buildHomeCircuit } from './circuits.js';
import { haversine } from './engine/route-geometry/haversine.js';

describe('home privacy offset', () => {
	it('starts public line at least 150m from exact home', () => {
		const home: [number, number] = [-33.9249, 18.4241];
		const line: [number, number][] = [home, [-33.9259, 18.4251], [-33.9269, 18.4261]];
		const pub = offsetStart(line, home, 200);
		expect(pub.length).toBeGreaterThan(1);
		expect(pub[0]).not.toEqual(home);
	});
});

describe('buildHomeCircuit', () => {
	const home: [number, number] = [-33.9249, 18.4241];

	it('returns a ScoredResult-shaped circuit near the km target', () => {
		const r = buildHomeCircuit(home, 5, '336|30|12', 'eskate');
		expect(r.line.length).toBeGreaterThan(1);
		expect(r.totalWh).toBeGreaterThan(0);
		expect(['fly', 'ok', 'caution', 'stop']).toContain(r.verdict.level);
		// domain.applyResult() shape
		expect(r.pts).toEqual(r.line);
		expect(r.coords.length).toBe(2);
		expect(r.boardVal).toBe('336|30|12');
		expect(r.mode.label).toBeTruthy();
		expect(r.segs.length).toBe(r.line.length - 1);
		const km = r.cum[r.cum.length - 1] / 1000;
		expect(km).toBeGreaterThan(4);
		expect(km).toBeLessThan(6);
	});

	it('keeps the public start at least 150m from exact home', () => {
		const r = buildHomeCircuit(home, 8, '336|30|12', 'eskate');
		expect(haversine(home, r.line[0])).toBeGreaterThanOrEqual(150);
	});

	it('accepts an onboarding-style home object', () => {
		const r = buildHomeCircuit({ lat: home[0], lon: home[1] }, 12, '336|30|12', 'eskate');
		expect(r.line.length).toBeGreaterThan(1);
		expect(haversine(home, r.line[0])).toBeGreaterThanOrEqual(150);
	});
});
