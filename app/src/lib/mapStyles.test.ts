import { describe, it, expect } from 'vitest';
import {
	MAP_STYLES,
	DEFAULT_LIGHT_STYLE,
	DEFAULT_DARK_STYLE,
	styleById,
	isValidStyleId,
	defaultStyleForTheme
} from './mapStyles.js';

describe('map tile catalog', () => {
	it('has unique ids and a tile URL template per style', () => {
		const ids = MAP_STYLES.map((s) => s.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const s of MAP_STYLES) {
			expect(s.name.length).toBeGreaterThan(0);
			expect(s.url).toContain('{z}/{x}/{y}');
			expect(s.maxZoom).toBeGreaterThanOrEqual(10);
			expect(s.maxZoom).toBeLessThanOrEqual(22);
			expect(s.attribution).toContain('OpenStreetMap');
		}
	});

	it('covers both light and dark groups', () => {
		expect(MAP_STYLES.some((s) => s.group === 'light')).toBe(true);
		expect(MAP_STYLES.some((s) => s.group === 'dark')).toBe(true);
		expect(MAP_STYLES.some((s) => s.dark)).toBe(true);
	});

	it('resolves defaults to valid catalog ids', () => {
		expect(isValidStyleId(DEFAULT_LIGHT_STYLE)).toBe(true);
		expect(isValidStyleId(DEFAULT_DARK_STYLE)).toBe(true);
		expect(defaultStyleForTheme('light')).toBe(DEFAULT_LIGHT_STYLE);
		expect(defaultStyleForTheme('dark')).toBe(DEFAULT_DARK_STYLE);
	});

	it('styleById finds entries and misses cleanly', () => {
		expect(styleById('voyager')?.group).toBe('light');
		expect(styleById('darkmatter')?.dark).toBe(true);
		expect(styleById('nope')).toBeUndefined();
		expect(isValidStyleId('nope')).toBe(false);
	});
});
