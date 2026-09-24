import { describe, expect, it } from 'vitest';
import { previewRoute } from './privacy.js';

describe('event preview gate', () => {
	it('hides full route without membership or link', () => {
		expect(previewRoute({ isMember: false, hasLink: false })).toBe(true);
		expect(previewRoute({ isMember: true, hasLink: false })).toBe(false);
		expect(previewRoute({ isMember: false, hasLink: true })).toBe(false);
	});
});
