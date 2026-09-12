import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
	shouldPublish,
	publishPosition,
	resetPublishThrottle,
	PUBLISH_MS
} from './live.js';

const realFetch = globalThis.fetch;

beforeEach(() => {
	// publishPosition is browser-gated — stub window for the node test env.
	vi.stubGlobal('window', {});
});

afterEach(() => {
	globalThis.fetch = realFetch;
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	resetPublishThrottle();
});

describe('shouldPublish', () => {
	it('publishes when the window elapsed', () => {
		expect(shouldPublish(0, PUBLISH_MS)).toBe(true);
		expect(shouldPublish(1000, 1000 + PUBLISH_MS + 1)).toBe(true);
	});

	it('holds back inside the window', () => {
		expect(shouldPublish(1000, 1000 + PUBLISH_MS - 1)).toBe(false);
		expect(shouldPublish(1000, 1000)).toBe(false);
	});
});

describe('publishPosition', () => {
	const fix = { lat: -33.9, lon: 18.4, speed: 5, heading: 90, accuracy: 8 };

	it('PUTs the fix once per window', async () => {
		let calls = 0;
		let seenBody = '';
		globalThis.fetch = (async (_url: unknown, init?: { body?: string }) => {
			calls++;
			seenBody = init?.body ?? '';
			return { ok: true };
		}) as unknown as typeof fetch;
		await expect(publishPosition(fix)).resolves.toBe(true);
		await expect(publishPosition(fix)).resolves.toBe(false);
		expect(calls).toBe(1);
		expect(JSON.parse(seenBody)).toMatchObject({ lat: -33.9, lon: 18.4 });
	});

	it('returns false on network failure without throwing', async () => {
		globalThis.fetch = (async () => {
			throw new Error('offline');
		}) as unknown as typeof fetch;
		await expect(publishPosition(fix)).resolves.toBe(false);
	});
});
