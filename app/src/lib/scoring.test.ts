import { describe, it, expect } from 'vitest';
import { segWh, band, smooth3, mergePolylines } from './scoring.js';
import { resample, haversine, cumulative } from './util.js';
import { MODES, RIDER_KIT_KG } from './modes.js';

// SPEC.md regression values (e-skate defaults: mass 116.8 kg, drivetrain 80%).
// If a change moves these by more than ~5%, the change is wrong.
describe('SPEC regression values', () => {
	const mass = RIDER_KIT_KG + MODES.eskate.phys.vehicleKg; // 116.8
	const phys = MODES.eskate.phys;

	it('flat, 25 km/h, 1 km → 14.5 Wh', () => {
		expect(segWh(1000, 0, mass, 25, phys)).toBeCloseTo(14.5, 0);
	});

	it('flat, 40 km/h, 1 km → 24.7 Wh', () => {
		expect(segWh(1000, 0, mass, 40, phys)).toBeCloseTo(24.7, 0);
	});

	it('1.9 km with 60 m ascent, 25 km/h → 51.4 Wh', () => {
		// 60 m rise over 1900 m ≈ 3.158% grade
		const grade = 60 / 1900;
		expect(segWh(1900, grade, mass, 25, phys)).toBeCloseTo(51.4, 0);
	});
});

describe('energy clamp', () => {
	const mass = RIDER_KIT_KG + MODES.eskate.phys.vehicleKg;
	const phys = MODES.eskate.phys;

	it('descents draw nothing (no regen credited)', () => {
		expect(segWh(1000, -0.2, mass, 25, phys)).toBe(0);
	});

	it('flat at cruise speed uses positive energy', () => {
		expect(segWh(1000, 0, mass, 25, phys)).toBeGreaterThan(0);
	});
});

describe('gradient bands are deliberately asymmetric (SPEC)', () => {
	it('+9.9% is "working climb" (sage), -10% is "steep descent" (rust)', () => {
		expect(band(9.9)).toEqual({ c: '#8fae7a', k: 'working climb' });
		expect(band(-10)).toEqual({ c: '#b5502e', k: 'steep descent' });
	});

	it('-12% is past braking but +12% is only "hard climb"', () => {
		expect(band(-12)).toEqual({ c: '#4a1420', k: 'past braking' });
		expect(band(12)).toEqual({ c: '#c98a2c', k: 'hard climb' });
	});

	it('±4% is easy going (boundary inclusive on descent side)', () => {
		expect(band(-4)).toEqual({ c: '#c98a2c', k: 'watch your speed' });
		expect(band(3.9)).toEqual({ c: '#6b8f4e', k: 'easy going' });
		expect(band(4)).toEqual({ c: '#8fae7a', k: 'working climb' });
		expect(band(15)).toEqual({ c: '#b5502e', k: 'at the motor limit' });
		expect(band(10)).toEqual({ c: '#c98a2c', k: 'hard climb' }); // exactly 10% is NOT < 10
	});
});

describe('smooth3', () => {
	it('averages interior points, keeps endpoints', () => {
		expect(smooth3([1, 4, 7])).toEqual([1, 4, 7]); // (1+4+7)/3 = 4
		expect(smooth3([0, 3, 9])).toEqual([0, 4, 9]);
	});

	it('passes through short arrays', () => {
		expect(smooth3([5, 3])).toEqual([5, 3]);
	});
});

describe('resample', () => {
	it('emits points exactly `step` apart except the final remainder', () => {
		// ~1112 m per degree of latitude
		const line: [number, number][] = [
			[-33.9, 18.4],
			[-33.95, 18.4]
		];
		const step = 100;
		const pts = resample(line, step);
		for (let i = 1; i < pts.length - 1; i++) {
			const gap = haversine(pts[i - 1], pts[i]);
			expect(gap).toBeCloseTo(step, 0);
		}
		const lastGap = haversine(pts[pts.length - 2], pts[pts.length - 1]);
		expect(lastGap).toBeLessThanOrEqual(step);
		expect(lastGap).toBeGreaterThan(1); // the remainder point
		expect(haversine(pts[0], line[0])).toBeLessThan(0.001);
	});

	it('keeps the first point as-is', () => {
		const line: [number, number][] = [
			[-33.9, 18.4],
			[-33.9, 18.41]
		];
		expect(resample(line, 50)[0]).toEqual(line[0]);
	});
});

describe('cumulative', () => {
	it('starts at 0 and accumulates segment lengths', () => {
		const line: [number, number][] = [
			[-33.9, 18.4],
			[-33.9, 18.41],
			[-33.9, 18.42]
		];
		const cum = cumulative(line);
		expect(cum[0]).toBe(0);
		expect(cum[1]).toBeCloseTo(haversine(line[0], line[1]), 6);
		expect(cum[2]).toBeCloseTo(cum[1] + haversine(line[1], line[2]), 6);
	});
});

describe('mergePolylines', () => {
	it('groups consecutive same-colour segments', () => {
		const segs = [
			{ a: [0, 0] as [number, number], b: [0, 1] as [number, number], c: '#8fae7a', k: 'easy', grade: 1 },
			{ a: [0, 1] as [number, number], b: [0, 2] as [number, number], c: '#8fae7a', k: 'easy', grade: 2 },
			{ a: [0, 2] as [number, number], b: [0, 3] as [number, number], c: '#c98a2c', k: 'hard', grade: 12 },
			{ a: [0, 3] as [number, number], b: [0, 4] as [number, number], c: '#8fae7a', k: 'easy', grade: 3 }
		];
		const groups = mergePolylines(segs);
		expect(groups.length).toBe(3);
		expect(groups[0].c).toBe('#8fae7a');
		expect(groups[0].pts.length).toBe(3); // [0,0] [0,1] [0,2]
		expect(groups[1].c).toBe('#c98a2c');
		expect(groups[2].pts.length).toBe(2); // [0,3] [0,4]
	});

	it('returns empty for empty input', () => {
		expect(mergePolylines([])).toEqual([]);
	});
});
