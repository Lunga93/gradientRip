import { describe, expect, it } from 'vitest';
import { parseComment } from './comments.js';

describe('parseComment', () => {
	it('trims and enforces 1-500', () => {
		expect(parseComment('  hi  ')).toBe('hi');
		expect(parseComment('')).toBeNull();
		expect(parseComment('x'.repeat(501))).toBeNull();
	});
});
