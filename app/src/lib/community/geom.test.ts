import { describe, expect, it } from 'vitest';
import { geomHash } from './geom.js';

describe('geomHash', () => {
	it('is stable and sport-scoped', () => {
		const line: [number, number][] = [[-33.9249, 18.4241], [-33.925, 18.425]];
		expect(geomHash(line, 'eskate')).toBe(geomHash(line, 'eskate'));
		expect(geomHash(line, 'eskate')).not.toBe(geomHash(line, 'bike'));
	});
	it('rounds to 5 decimals', () => {
		const a: [number, number][] = [[-33.92491, 18.42411]];
		const b: [number, number][] = [[-33.924914, 18.424114]];
		expect(geomHash(a, 'eskate')).toBe(geomHash(b, 'eskate'));
	});
});
