import { describe, it, expect } from 'vitest';
import { renewedExpiry, nearLine, WORST_RANK } from './hazards.js';

describe('renewedExpiry', () => {
	it('extends 7 days capped at created+90d', () => {
		const created = new Date('2026-01-01T00:00:00Z').getTime();
		const exp = new Date('2026-01-20T00:00:00Z').getTime();
		expect(renewedExpiry(created, exp)).toBe(new Date('2026-01-27T00:00:00Z').getTime());
		expect(renewedExpiry(created, new Date('2026-04-01T00:00:00Z').getTime())).toBe(
			new Date('2026-04-01T00:00:00Z').getTime()
		);
	});
});

describe('nearLine', () => {
	it('detects pins within the corridor only', () => {
		const line: [number, number][] = [[-33.9, 18.4], [-33.901, 18.401]];
		expect(nearLine([-33.9002, 18.4002], line, 200)).toBe(true);
		expect(nearLine([-34.5, 19.0], line, 200)).toBe(false);
	});
});

describe('WORST_RANK', () => {
	it('ranks closure above pothole', () => {
		expect(WORST_RANK['closure'] < WORST_RANK['pothole']).toBe(true);
	});
});
