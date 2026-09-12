import { describe, it, expect } from 'vitest';
import { parseBoardVal, domain } from './domain.svelte.js';

describe('parseBoardVal', () => {
	it('accepts shipped preset triples', () => {
		expect(parseBoardVal('336|30|12')).toEqual([336, 30, 12]);
		expect(parseBoardVal('1200|6|10')).toEqual([1200, 6, 10]);
	});

	it('accepts in-range custom triples', () => {
		expect(parseBoardVal('500|25|10')).toEqual([500, 25, 10]);
	});

	it('rejects malformed or out-of-range triples', () => {
		expect(parseBoardVal('bad')).toBeNull();
		expect(parseBoardVal('336|30')).toBeNull();
		expect(parseBoardVal('0|0|0')).toBeNull();
		expect(parseBoardVal('99999|30|12')).toBeNull();
		expect(parseBoardVal('336|99|12')).toBeNull();
		expect(parseBoardVal(null)).toBeNull();
	});
});

describe('setCustomBoard', () => {
	it('stores a valid custom triple', () => {
		expect(domain.setCustomBoard(500, 25, 10)).toBe(true);
		expect(domain.boardVal).toBe('500|25|10');
	});

	it('rejects out-of-range values without changing state', () => {
		const before = domain.boardVal;
		expect(domain.setCustomBoard(10, 25, 10)).toBe(false);
		expect(domain.boardVal).toBe(before);
	});
});
