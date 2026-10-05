import { describe, it, expect } from 'vitest';
import { contentTypeForExt } from './media.js';

describe('contentTypeForExt', () => {
	it.each([
		['jpg', 'image/jpeg'],
		['jpeg', 'image/jpeg'],
		['png', 'image/png'],
		['webp', 'image/webp'],
		['gif', 'image/gif'],
		['avif', 'image/avif'],
		['mp4', 'video/mp4'],
		['mov', 'video/quicktime'],
		['webm', 'video/webm'],
		['m4v', 'video/x-m4v']
	])('maps %s to %s', (ext, expected) => {
		expect(contentTypeForExt(ext)).toBe(expected);
	});

	it('normalizes uppercase and leading dots', () => {
		expect(contentTypeForExt('JPG')).toBe('image/jpeg');
		expect(contentTypeForExt('GIF')).toBe('image/gif');
		expect(contentTypeForExt('AVIF')).toBe('image/avif');
		expect(contentTypeForExt('WEBM')).toBe('video/webm');
		expect(contentTypeForExt('M4V')).toBe('video/x-m4v');
		expect(contentTypeForExt('.png')).toBe('image/png');
	});

	it('returns null for unknown extensions', () => {
		expect(contentTypeForExt('exe')).toBeNull();
		expect(contentTypeForExt('xyz')).toBeNull();
	});
});
