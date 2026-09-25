// app/src/lib/ui/nav.test.ts
import { describe, it, expect } from 'vitest';
import { TABS, isTabActive, detailParent } from './nav.js';

describe('route table', () => {
	it('has exactly the five approved tabs in order', () => {
		expect(TABS.map((t) => t.key)).toEqual(['home', 'map', 'explore', 'activity', 'me']);
	});
	it('marks nested explore children active for /explore', () => {
		expect(isTabActive('/explore', '/explore/crews')).toBe(true);
		expect(isTabActive('/map', '/explore/crews')).toBe(false);
	});
	it('resolves detail parents', () => {
		expect(detailParent('/crew/abc')).toBe('/explore/crews');
		expect(detailParent('/route/abc')).toBe('/explore/routes');
		expect(detailParent('/event/abc')).toBe('/explore/events');
		expect(detailParent('/me/rides')).toBeNull();
	});
});
