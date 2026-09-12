import { describe, it, expect } from 'vitest';
import { canonicalPair, normalizeEmail } from './friends.js';
import { classifyFreshness, LIVE_FRESH_MS, LIVE_STALE_MS } from './live.js';

describe('canonicalPair', () => {
	it('orders lexicographically regardless of input order', () => {
		expect(canonicalPair('b', 'a')).toEqual(['a', 'b']);
		expect(canonicalPair('a', 'b')).toEqual(['a', 'b']);
	});
});

describe('normalizeEmail', () => {
	it('trims and lowercases valid emails', () => {
		expect(normalizeEmail('  Ann@Example.COM ')).toBe('ann@example.com');
	});

	it.each([[null], [42], ['nope'], ['a@b'], ['@b.com'], ['a @b.com']])(
		'rejects %j',
		(v) => {
			expect(normalizeEmail(v)).toBeNull();
		}
	);
});

describe('classifyFreshness', () => {
	const now = Date.now();
	const ago = (ms: number): string => new Date(now - ms).toISOString();

	it('is live inside the fresh window', () => {
		expect(classifyFreshness(ago(1000), now)).toBe('live');
		expect(classifyFreshness(ago(LIVE_FRESH_MS), now)).toBe('live');
	});

	it('is stale inside the stale window', () => {
		expect(classifyFreshness(ago(LIVE_FRESH_MS + 1000), now)).toBe('stale');
		expect(classifyFreshness(ago(LIVE_STALE_MS), now)).toBe('stale');
	});

	it('vanishes when older than the stale window', () => {
		expect(classifyFreshness(ago(LIVE_STALE_MS + 1000), now)).toBeNull();
	});

	it('handles null, garbage, and future timestamps', () => {
		expect(classifyFreshness(null, now)).toBeNull();
		expect(classifyFreshness('not-a-date', now)).toBeNull();
		expect(classifyFreshness(new Date(now + 60_000).toISOString(), now)).toBeNull();
	});
});
