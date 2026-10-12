import { describe, expect, it } from 'vitest';
import { canReadChannel } from './channels-rules.js';
import { composeCrewHref } from './channels.svelte.js';

describe('channel visibility', () => {
	it('open readable by all, private by members', () => {
		expect(canReadChannel('open', false)).toBe(true);
		expect(canReadChannel('private', false)).toBe(false);
		expect(canReadChannel('private', true)).toBe(true);
	});
});

describe('composeCrewHref', () => {
	it('emits the resolved compose route with the crew id as query', () => {
		const id = '33333333-3333-4333-8333-333333333333';
		expect(composeCrewHref('/compose', id)).toBe(`/compose?crew=${id}`);
	});

	it('encodes crew ids that need it', () => {
		expect(composeCrewHref('/compose', 'a/b?c')).toBe('/compose?crew=a%2Fb%3Fc');
	});
});
