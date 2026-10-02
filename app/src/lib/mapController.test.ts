// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
	createMap,
	destroyMap,
	renderFriendMarkers,
	clearFriendMarkers,
	getMap,
	type FriendPin
} from './mapController.svelte.js';

const pins: FriendPin[] = [
	{ id: 'a', name: 'Ada', avatar: '', lat: -33.9, lon: 18.4, stale: false },
	{ id: 'b', name: 'Bo', avatar: '', lat: -33.91, lon: 18.41, stale: true }
];

const pinCount = (): number => document.querySelectorAll('.friend-pin').length;

beforeEach(() => {
	destroyMap();
	document.body.innerHTML = '';
});

describe('pendingPins lifecycle', () => {
	it('pre-init pins flush on init instead of dropping', async () => {
		// Map is down: pins must cache, not throw or drop.
		renderFriendMarkers(pins);
		expect(getMap()).toBeNull();

		const el = document.createElement('div');
		el.style.width = '400px';
		el.style.height = '400px';
		document.body.appendChild(el);
		await createMap(el, [-33.9, 18.4]);

		// Flushed onto the fresh map.
		expect(pinCount()).toBe(2);
	});

	it('unmount clears cached pins so a remount starts clean', async () => {
		const el = document.createElement('div');
		el.style.width = '400px';
		el.style.height = '400px';
		document.body.appendChild(el);
		await createMap(el, [-33.9, 18.4]);
		renderFriendMarkers(pins);
		expect(pinCount()).toBe(2);

		destroyMap();
		expect(getMap()).toBeNull();

		// Stale cache must not outlive unmount: a fresh map with no new pins
		// renders zero pins (would be 2 if destroy leaked the cache).
		const el2 = document.createElement('div');
		el2.style.width = '400px';
		el2.style.height = '400px';
		document.body.appendChild(el2);
		await createMap(el2, [-33.9, 18.4]);
		expect(pinCount()).toBe(0);
	});

	it('clearFriendMarkers empties pins without destroying the map', async () => {
		const el = document.createElement('div');
		el.style.width = '400px';
		el.style.height = '400px';
		document.body.appendChild(el);
		await createMap(el, [-33.9, 18.4]);
		renderFriendMarkers(pins);
		expect(pinCount()).toBe(2);
		clearFriendMarkers();
		expect(pinCount()).toBe(0);
		expect(getMap()).not.toBeNull();
	});
});
