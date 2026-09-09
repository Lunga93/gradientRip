import { describe, it, expect } from 'vitest';
import { buildPlanPacket, smooth3, type PlanPacket } from './index.js';

const rawElev = [0, 0, 0, 0, 1, 0, 0, 0, 0];
const pts: [number, number][] = rawElev.map((_, i) => [-33.9, 18.4 + i * 0.0001]);
const line = pts;

const packet = (): PlanPacket => {
	return buildPlanPacket({
		line,
		coords: [pts[0], pts[pts.length - 1]],
		pts,
		elev: rawElev,
		boardVal: '250|10|20',
		modeId: 'eskate',
		queries: ['a', 'b'],
		source: 'planned'
	});
}

describe('buildPlanPacket, 3-point smoothing (migration regression guard)', () => {
	it('smoothes elevation before grading', () => {
		const p = packet();
		expect(p.elev).toEqual(smooth3(rawElev));
		expect(p.elev[4]).toBeCloseTo(1 / 3, 6);
	});

	it('turns a lone ~9% DEM spike into a ~3% manageable grade', () => {
		const p = packet();
		const steepest = p.segs.reduce((a, b) => (Math.abs(b.grade) > Math.abs(a.grade) ? b : a));
		expect(Math.abs(steepest.grade)).toBeCloseTo(3.6, 1);
		expect(steepest.k).toBe('easy going');
	});

	it('still reports a usable non-zero verdict', () => {
		const p = packet();
		expect(p.totalWh).toBeGreaterThan(0);
		expect(p.verdict.level).toBe('ok');
	});
});

describe('buildPlanPacket mode physics', () => {
	const flatElev = [10, 10, 10, 10, 10, 10, 10, 10, 10];
	const base = {
		line,
		coords: [pts[0], pts[pts.length - 1]] as [number, number][],
		pts,
		queries: ['a', 'b'],
		source: 'planned' as const
	};

	it('uses per-mode physics, not eskate for everything', () => {
		const eskate = buildPlanPacket({ ...base, elev: flatElev, boardVal: '500|25|22', modeId: 'eskate' });
		const ebike = buildPlanPacket({ ...base, elev: flatElev, boardVal: '500|25|22', modeId: 'ebike' });
		expect(eskate.totalWh).toBeGreaterThan(0);
		expect(ebike.totalWh).toBeGreaterThan(0);
		expect(ebike.totalWh).not.toBeCloseTo(eskate.totalWh, 6);
	});

	it('falls back on bad mode/board instead of throwing', () => {
		const p = buildPlanPacket({ ...base, elev: flatElev, boardVal: 'bad', modeId: 'nope' });
		expect(p.modeId).toBe('eskate');
		expect(p.totalWh).toBeGreaterThan(0);
	});
});