import { describe, it, expect } from 'vitest';
import { buildPlanPacket, smooth5, type PlanPacket } from './index.js';

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

describe('buildPlanPacket, 5-point smoothing (migration regression guard)', () => {
	it('smoothes elevation before grading', () => {
		const p = packet();
		expect(p.elev).toEqual(smooth5(rawElev));
		expect(p.elev[4]).toBeCloseTo(0.2, 6);
	});

	it('turns a lone ~9% DEM spike into a sub-3% manageable grade', () => {
		const p = packet();
		const steepest = p.segs.reduce((a, b) => (Math.abs(b.grade) > Math.abs(a.grade) ? b : a));
		expect(Math.abs(steepest.grade)).toBeLessThan(3);
		expect(steepest.k).toBe('easy going');
	});

	it('still reports a usable non-zero verdict', () => {
		const p = packet();
		expect(p.totalWh).toBeGreaterThan(0);
		expect(p.verdict.level).toBe('fly');
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

describe('fly reward band', () => {
	// Flat line of N points ~111 m apart; e-skate burns ~13 Wh/km flat, so
	// distance (and only distance) moves the verdict between fly and ok.
	// Board 250 Wh → usable 217.5 Wh; fly below 30% (65 Wh), ok below 70%.
	const flatLine = (n: number): [number, number][] =>
		Array.from({ length: n }, (_, i) => [-33.9, 18.4 + i * 0.001]);
	const flatPacket = (n: number) => {
		const pts = flatLine(n);
		return buildPlanPacket({
			line: pts,
			coords: [pts[0], pts[pts.length - 1]],
			pts,
			elev: pts.map(() => 10),
			boardVal: '250|10|20',
			modeId: 'eskate',
			queries: ['a', 'b'],
			source: 'planned'
		});
	};

	it('short flat route sips the pack → fly', () => {
		const p = flatPacket(20);
		expect(p.totalWh).toBeLessThan(p.usableWh * 0.3);
		expect(p.verdict.level).toBe('fly');
	});

	it('longer flat route in the middle band → ok, never collapsed into fly', () => {
		const p = flatPacket(70);
		expect(p.totalWh).toBeGreaterThanOrEqual(p.usableWh * 0.3);
		expect(p.totalWh).toBeLessThanOrEqual(p.usableWh * 0.7);
		expect(p.verdict.level).toBe('ok');
	});
});