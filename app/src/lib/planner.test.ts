import { describe, it, expect, vi, beforeEach } from 'vitest';
import { snapDrawnLeg, snapDrawnLine } from './planner.svelte.js';
import type { LatLon } from './util.js';
import * as api from './api.js';

describe('snapDrawnLeg and snapDrawnLine', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('returns straight line if points are identical or very close', async () => {
		const a: LatLon = [-33.9, 18.4];
		const b: LatLon = [-33.9, 18.4001]; // ~11m - clearly less than RESAMPLE_STEP_M (50m) but > 1m
		const res = await snapDrawnLeg(a, b);
		expect(res.snapped).toBe(false);
		expect(res.leg).toEqual([a, b]);
	});

	it('snaps to road geometry when fetchRoute returns valid path within snap threshold', async () => {
		const a: LatLon = [-33.9, 18.4];
		const b: LatLon = [-33.905, 18.405];
		const mockRoadPath: LatLon[] = [
			a,
			[-33.902, 18.401],
			[-33.904, 18.403],
			b
		];

		vi.spyOn(api, 'route').mockResolvedValue(mockRoadPath);

		const res = await snapDrawnLeg(a, b);
		expect(res.snapped).toBe(true);
		expect(res.leg).toEqual(mockRoadPath);
	});

	it('falls back to interpolated straight line when route fetch fails', async () => {
		const a: LatLon = [-33.9, 18.4];
		const b: LatLon = [-33.905, 18.4]; // ~556m

		vi.spyOn(api, 'route').mockRejectedValue(new Error('Network error'));

		const res = await snapDrawnLeg(a, b);
		expect(res.snapped).toBe(false);
		expect(res.leg.length).toBeGreaterThan(2);
		expect(res.leg[0]).toEqual(a);
		expect(res.leg[res.leg.length - 1][0]).toBeCloseTo(b[0], 4);
	});

	it('snapDrawnLine correctly combines multiple legs', async () => {
		const p1: LatLon = [-33.9, 18.4];
		const p2: LatLon = [-33.905, 18.405];
		const p3: LatLon = [-33.91, 18.41];

		vi.spyOn(api, 'route').mockImplementation(async (a, b) => {
			return [a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], b];
		});

		const result = await snapDrawnLine([p1, p2, p3]);
		expect(result.snapped).toBe(2);
		expect(result.straight).toBe(0);
		expect(result.line[0]).toEqual(p1);
		expect(result.line[result.line.length - 1]).toEqual(p3);
	});
});
