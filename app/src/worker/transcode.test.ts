import { describe, expect, it } from 'vitest';
import { posterSeekSeconds } from './transcode.js';

describe('posterSeekSeconds', () => {
	it('uses the midpoint for sub-second videos', () => {
		expect(posterSeekSeconds(0.4)).toBeCloseTo(0.2);
	});

	it('keeps the verbatim 1s seek for normal videos', () => {
		expect(posterSeekSeconds(30)).toBe(1);
	});
});
