import { describe, it, expect } from 'vitest';
import { fitWithin } from './media.js';

describe('fitWithin', () => {
	it('caps the long edge at max, preserving ratio', () => {
		expect(fitWithin(4000, 3000, 1600)).toEqual([1600, 1200]);
		expect(fitWithin(800, 600, 1600)).toEqual([800, 600]);
		expect(fitWithin(100, 4000, 1600)).toEqual([40, 1600]);
	});
});

describe('putObjectBytes request shape (CORS contract)', () => {
	it('PUTs raw bytes with no Content-Type header', async () => {
		const { putObjectBytes } = await import('./media.js');
		const calls: { url: unknown; init: RequestInit }[] = [];
		const orig = globalThis.fetch;
		globalThis.fetch = (async (url: unknown, init: RequestInit) => {
			calls.push({ url, init });
			return new Response('{}', { status: 200 });
		}) as typeof fetch;
		try {
			await putObjectBytes('http://127.0.0.1:9000/put', new Uint8Array([1, 2, 3]));
		} finally {
			globalThis.fetch = orig;
		}
		expect(calls).toHaveLength(1);
		expect(calls[0].init.method).toBe('PUT');
		// Raw bytes only — never a Blob/File (those would smuggle a
		// Content-Type onto the wire and fail s3rver preflight).
		expect(
			calls[0].init.body instanceof ArrayBuffer || calls[0].init.body instanceof Uint8Array
		).toBe(true);
		expect(new Headers(calls[0].init.headers).has('content-type')).toBe(false);
	});

	it('surfaces non-2xx uploads as errors', async () => {
		const { putObjectBytes } = await import('./media.js');
		const orig = globalThis.fetch;
		globalThis.fetch = (async () => new Response('forbidden', { status: 403 })) as typeof fetch;
		try {
			await expect(putObjectBytes('http://127.0.0.1:9000/put', new Uint8Array([1]))).rejects.toThrow(
				/403/
			);
		} finally {
			globalThis.fetch = orig;
		}
	});
});
