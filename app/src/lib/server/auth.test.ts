import { describe, it, expect, afterEach, vi } from 'vitest';
import {
	hashToken,
	newToken,
	buildGoogleAuthUrl,
	validateGoogleProfile,
	exchangeCode,
	fetchGoogleProfile
} from './auth.js';

const realFetch = globalThis.fetch;

afterEach(() => {
	globalThis.fetch = realFetch;
	vi.restoreAllMocks();
});

describe('auth tokens', () => {
	it('hashes deterministically to 64 hex chars', () => {
		const h1 = hashToken('abc');
		expect(h1).toBe(hashToken('abc'));
		expect(h1).toMatch(/^[0-9a-f]{64}$/);
		expect(hashToken('abd')).not.toBe(h1);
	});

	it('mints unique 64-char tokens', () => {
		const a = newToken();
		expect(a).toMatch(/^[0-9a-f]{64}$/);
		expect(newToken()).not.toBe(a);
	});
});

describe('google auth URL', () => {
	it('points at Google with the required params', () => {
		const url = new URL(buildGoogleAuthUrl('CID', 'https://app.example/cb', 'STATE123'));
		expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
		expect(url.searchParams.get('client_id')).toBe('CID');
		expect(url.searchParams.get('redirect_uri')).toBe('https://app.example/cb');
		expect(url.searchParams.get('response_type')).toBe('code');
		expect(url.searchParams.get('state')).toBe('STATE123');
		expect(url.searchParams.get('scope')).toContain('openid');
		expect(url.searchParams.get('scope')).toContain('email');
	});
});

describe('google profile validation', () => {
	it('accepts a full profile', () => {
		expect(
			validateGoogleProfile({ sub: '123', email: 'a@b.com', name: 'Ann', picture: 'http://p' })
		).toEqual({ sub: '123', email: 'a@b.com', name: 'Ann', picture: 'http://p' });
	});

	it('falls back to the email local part for a missing name', () => {
		expect(validateGoogleProfile({ sub: '123', email: 'ann@b.com' })).toMatchObject({
			sub: '123',
			name: 'ann',
			picture: ''
		});
	});

	it.each([[null], [undefined], ['x'], [{}], [{ sub: '1' }], [{ email: 'a@b.com' }], [{ sub: '1', email: 'nope' }]])(
		'rejects malformed payload %j',
		(v) => {
			expect(validateGoogleProfile(v)).toBeNull();
		}
	);
});

describe('token exchange', () => {
	it('returns the access token on success', async () => {
		globalThis.fetch = (async () => ({
			ok: true,
			json: async () => ({ access_token: 'TOK', token_type: 'Bearer' })
		})) as unknown as typeof fetch;
		await expect(exchangeCode('CODE', 'CID', 'SEC', 'https://app/cb')).resolves.toBe('TOK');
	});

	it('throws 502 when Google errors or omits the token', async () => {
		globalThis.fetch = (async () => ({ ok: false, status: 400 })) as unknown as typeof fetch;
		await expect(exchangeCode('CODE', 'CID', 'SEC', 'https://app/cb')).rejects.toMatchObject({
			status: 502
		});
		globalThis.fetch = (async () => ({
			ok: true,
			json: async () => ({})
		})) as unknown as typeof fetch;
		await expect(exchangeCode('CODE', 'CID', 'SEC', 'https://app/cb')).rejects.toMatchObject({
			status: 502
		});
	});
});

describe('userinfo fetch', () => {
	it('returns the validated profile with a bearer header', async () => {
		let seenAuth = '';
		globalThis.fetch = (async (_url: unknown, init?: { headers?: Record<string, string> }) => {
			seenAuth = init?.headers?.Authorization ?? '';
			return {
				ok: true,
				json: async () => ({ sub: '9', email: 'z@x.com', name: 'Zed' })
			};
		}) as unknown as typeof fetch;
		await expect(fetchGoogleProfile('TOK')).resolves.toMatchObject({ sub: '9', name: 'Zed' });
		expect(seenAuth).toBe('Bearer TOK');
	});

	it('throws 502 on bad status or malformed profile', async () => {
		globalThis.fetch = (async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
		await expect(fetchGoogleProfile('TOK')).rejects.toMatchObject({ status: 502 });
		globalThis.fetch = (async () => ({
			ok: true,
			json: async () => ({ sub: '9' })
		})) as unknown as typeof fetch;
		await expect(fetchGoogleProfile('TOK')).rejects.toMatchObject({ status: 502 });
	});
});
