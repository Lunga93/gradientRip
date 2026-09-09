import { describe, it, expect, afterEach, vi } from 'vitest';
import { elevations } from './services.js';
import type { LatLon } from '../util.js';

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
	vi.restoreAllMocks();
});

// 250 points → 3 chunks fetched concurrently with random completion order;
// the merged array must still follow input order.
describe('elevations chunk ordering', () => {
	it('preserves input order across concurrent chunks', async () => {
		const pts: LatLon[] = Array.from({ length: 250 }, (_, i) => [-33.9, 18.4 + i * 0.0001]);
		globalThis.fetch = (async (url: unknown) => {
			const u = new URL(url as string);
			// longitude varies per point (latitude is constant here)
			const lons = (u.searchParams.get('longitude') || '').split(',');
			const count = lons.length;
			const startIdx = Math.round((parseFloat(lons[0]) - 18.4) / 0.0001);
			await new Promise((r) => setTimeout(r, Math.random() * 20));
			return {
				ok: true,
				json: async () => ({ elevation: Array.from({ length: count }, (_, j) => startIdx + j) })
			};
		}) as typeof fetch;

		const out = await elevations(pts);
		expect(out).toHaveLength(250);
		out.forEach((v, i) => expect(v).toBe(i));
	});
});
