import { describe, expect, it } from 'vitest';
import { parseSports, parseHome, parseUnits } from './profile.js';

describe('profile validators', () => {
	it('keeps only known sports', () => {
		expect(parseSports(['eskate', 'run', 'nope'])).toEqual(['eskate']);
	});
	it('rejects bad home', () => {
		expect(parseHome({ lat: 1 })).toBeNull();
		expect(parseHome({ lat: -33.9, lon: 18.4, label: 'Sea Point' })?.label).toBe('Sea Point');
	});
	it('defaults units to km', () => {
		expect(parseUnits('miles')).toBe('km');
	});
});
