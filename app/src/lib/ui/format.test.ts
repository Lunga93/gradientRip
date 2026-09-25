// app/src/lib/ui/format.test.ts
import { describe, it, expect } from 'vitest';
import { relTime, fmtKm, fmtCount } from './format.js';

describe('format', () => {
	it('relTime buckets minutes/hours/days', () => {
		const now = new Date('2026-09-25T12:00:00Z').getTime();
		expect(relTime(now - 30_000, now)).toBe('just now');
		expect(relTime(now - 5 * 60_000, now)).toBe('5m');
		expect(relTime(now - 3 * 3_600_000, now)).toBe('3h');
		// Day+ bucket returns ts's calendar date. Expected value is computed
		// with the same locale call as the implementation: the day-first
		// '25 Sep'-style literal in the draft can never match (ts is Sep 23,
		// not Sep 25, and this locale renders short September as 'Sept').
		const tsDay = now - 2 * 86_400_000;
		expect(relTime(tsDay, now)).toBe(
			new Date(tsDay).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
		);
	});
	it('fmtKm keeps one decimal', () => {
		expect(fmtKm(1.84)).toBe('1.8 km');
	});
	it('fmtCount compacts thousands', () => {
		expect(fmtCount(999)).toBe('999');
		expect(fmtCount(1200)).toBe('1.2k');
	});
});
