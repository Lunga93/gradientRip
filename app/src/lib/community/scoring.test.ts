import { describe, expect, it } from 'vitest';
import { routeScore, fitBadge } from './scoring.js';

describe('scoring', () => {
	it('rewards saves over rides and decays with age', () => {
		expect(routeScore(10, 5, 0, 0)).toBeGreaterThan(routeScore(10, 5, 0, 30));
		expect(routeScore(0, 6, 0, 0)).toBeGreaterThan(routeScore(10, 0, 0, 0));
	});
	it('flags brake over-limit as stop', () => {
		expect(fitBadge(10, 100, 5, 30, -20, 12)).toBe('stop');
	});
});
