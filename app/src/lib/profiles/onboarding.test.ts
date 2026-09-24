import { describe, expect, it } from 'vitest';
import { coerceDraft } from './onboarding.js';

describe('onboarding draft', () => {
	it('fills defaults and trims name', () => {
		const d = coerceDraft({ displayName: '  Lungy  ', sports: ['eskate', 'x'], modeId: 'eskate', boardVal: '336|30|12', home: null });
		expect(d.displayName).toBe('Lungy');
		expect(d.sports).toEqual(['eskate']);
		expect(d.modeId).toBe('eskate');
	});
	it('rejects unknown mode', () => {
		expect(coerceDraft({ modeId: 'hoverboard' }).modeId).toBe('eskate');
	});
});
