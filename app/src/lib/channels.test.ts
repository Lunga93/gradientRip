import { describe, expect, it } from 'vitest';
import { canReadChannel } from './channels-rules.js';

describe('channel visibility', () => {
	it('open readable by all, private by members', () => {
		expect(canReadChannel('open', false)).toBe(true);
		expect(canReadChannel('private', false)).toBe(false);
		expect(canReadChannel('private', true)).toBe(true);
	});
});
