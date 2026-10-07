// app/src/lib/ui/nav.test.ts
import { describe, it, expect } from 'vitest';
import { TABS, isTabActive, detailParent, stripParams } from './nav.js';

describe('route table', () => {
	it('has exactly the five approved tabs in order', () => {
		expect(TABS.map((t) => t.key)).toEqual(['home', 'map', 'explore', 'activity', 'me']);
	});
	it('marks nested explore children active for /explore', () => {
		expect(isTabActive('/explore', '/explore/crews')).toBe(true);
		expect(isTabActive('/map', '/explore/crews')).toBe(false);
	});
	it('keeps Explore active on its detail pages', () => {
		expect(isTabActive('/explore', '/route/abc')).toBe(true);
		expect(isTabActive('/explore', '/event/abc')).toBe(true);
		expect(isTabActive('/explore', '/crew/abc')).toBe(true);
		expect(isTabActive('/map', '/route/abc')).toBe(false);
		expect(isTabActive('/map', '/event/abc')).toBe(false);
		expect(isTabActive('/map', '/crew/abc')).toBe(false);
		expect(isTabActive('/explore', '/me/rides')).toBe(false);
	});
	it('keeps Home active on post detail pages', () => {
		expect(isTabActive('/home', '/post/abc')).toBe(true);
		expect(isTabActive('/explore', '/post/abc')).toBe(false);
		expect(detailParent('/post/abc')).toBe('/home');
	});
	it('resolves detail parents', () => {
		expect(detailParent('/crew/abc')).toBe('/explore/crews');
		expect(detailParent('/route/abc')).toBe('/explore/routes');
		expect(detailParent('/event/abc')).toBe('/explore/events');
		expect(detailParent('/me/rides')).toBeNull();
	});
	it('strips login+reason params, keeping other params and hash', () => {
		expect(
			stripParams('https://x.test/home?login=ok&tab=me#top', ['login', 'reason'])
		).toBe('/home?tab=me#top');
		expect(stripParams('https://x.test/home?login=error&reason=denied', ['login', 'reason'])).toBe(
			'/home'
		);
	});
});
