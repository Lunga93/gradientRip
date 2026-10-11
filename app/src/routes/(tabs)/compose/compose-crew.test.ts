// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

const mockGoto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto: mockGoto }));

const mockPage = vi.hoisted(() => ({
	url: new URL('http://localhost/compose'),
	params: {} as Record<string, string>,
	data: {} as Record<string, unknown>
}));
vi.mock('$app/state', () => ({ page: mockPage }));

import ComposePage from './+page.svelte';
import { channels, type Channel } from '$lib/channels.svelte.js';

const CREW_A_ID = '33333333-3333-4333-8333-333333333333';
const CREW_B_ID = '44444444-4444-4444-8444-444444444444';

const crew = (over: Partial<Channel> = {}): Channel => ({
	id: CREW_A_ID,
	name: 'Dawn Patrol',
	visibility: 'open',
	sport: 'eskate',
	home_area: null,
	about: null,
	avatar_key: null,
	created_at: new Date('2026-10-01T08:00:00Z').toISOString(),
	is_member: true,
	is_admin: true,
	member_count: 3,
	...over
});

const resp = (status: number, data: unknown): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => data
	}) as Response;

interface Seen {
	url: string;
	method: string;
	body: unknown;
}

const mockFetch = (crews: Channel[], seen: Seen[]): void => {
	globalThis.fetch = (async (u: unknown, init?: unknown) => {
		const url = String(u);
		const method = (init as RequestInit | undefined)?.method ?? 'GET';
		const raw = (init as RequestInit | undefined)?.body;
		let body: unknown;
		try {
			body = typeof raw === 'string' ? JSON.parse(raw) : null;
		} catch {
			body = null;
		}
		seen.push({ url, method, body });
		if (url.includes('/api/channels')) return resp(200, { channels: crews });
		if (url.includes('/api/trips')) return resp(200, []);
		if (url.includes('/api/routes/explore')) return resp(200, { routes: [] });
		if (url === '/api/posts' && method === 'POST') return resp(200, { ok: true, id: 'p1' });
		return resp(404, {});
	}) as unknown as typeof fetch;
};

const realFetch = globalThis.fetch;

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	globalThis.fetch = realFetch;
	channels.channels = [];
	channels.loading = false;
	channels.lastError = '';
	mockPage.url = new URL('http://localhost/compose');
	vi.restoreAllMocks();
	mockGoto.mockClear();
});

const crewsAB = () => [crew(), crew({ id: CREW_B_ID, name: 'Night Owls', is_admin: false })];

describe('composer audience trio', () => {
	it('offers Everyone / Friends / Crew with Everyone pressed by default', async () => {
		const seen: Seen[] = [];
		mockFetch(crewsAB(), seen);
		render(ComposePage);
		expect(screen.getByRole('button', { name: 'Visible to everyone' }).getAttribute('aria-pressed')).toBe(
			'true'
		);
		expect(
			screen.getByRole('button', { name: 'Visible to friends only' }).getAttribute('aria-pressed')
		).toBe('false');
		const crewBtn = screen.getByRole('button', { name: 'Visible to crew only' });
		expect(crewBtn.getAttribute('aria-pressed')).toBe('false');
		// No crew picker until Crew is chosen.
		expect(screen.queryByRole('group', { name: 'Pick a crew' })).toBeNull();
	});

	it('Crew reveals the my-crews radio picker; Post stays disabled until a crew is picked', async () => {
		const seen: Seen[] = [];
		mockFetch(crewsAB(), seen);
		render(ComposePage);
		await fireEvent.input(screen.getByLabelText(/what's happening/i), {
			target: { value: 'Dawn patrol report' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Visible to crew only' }));
		expect(await screen.findByRole('group', { name: 'Pick a crew' })).toBeTruthy();
		expect(screen.getByRole('radio', { name: 'Dawn Patrol' })).toBeTruthy();
		expect(screen.getByRole('radio', { name: 'Night Owls' })).toBeTruthy();
		// Content present but no crew picked → Post disabled.
		expect(screen.getByRole('button', { name: 'Publish post' }).hasAttribute('disabled')).toBe(true);
		await fireEvent.click(screen.getByRole('radio', { name: 'Dawn Patrol' }));
		expect(screen.getByRole('button', { name: 'Publish post' }).hasAttribute('disabled')).toBe(false);
	});

	it('submits crew_id with a crew post', async () => {
		const seen: Seen[] = [];
		mockFetch(crewsAB(), seen);
		render(ComposePage);
		await fireEvent.input(screen.getByLabelText(/what's happening/i), {
			target: { value: 'Dawn patrol report' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Visible to crew only' }));
		await fireEvent.click(await screen.findByRole('radio', { name: 'Night Owls' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Publish post' }));
		await vi.waitFor(() => {
			expect(seen.some((s) => s.url === '/api/posts' && s.method === 'POST')).toBe(true);
		});
		const sent = seen.find((s) => s.url === '/api/posts')?.body as Record<string, unknown>;
		expect(sent.visibility).toBe('crew');
		expect(sent.crew_id).toBe(CREW_B_ID);
		expect(mockGoto).toHaveBeenCalledOnce();
	});

	it('pre-selects the crew from ?crew= (Task 5 entry point)', async () => {
		const seen: Seen[] = [];
		mockFetch(crewsAB(), seen);
		mockPage.url = new URL(`http://localhost/compose?crew=${CREW_A_ID}`);
		render(ComposePage);
		const radio = (await screen.findByRole('radio', { name: 'Dawn Patrol' })) as HTMLInputElement;
		expect(radio.checked).toBe(true);
		expect(
			screen.getByRole('button', { name: 'Visible to crew only' }).getAttribute('aria-pressed')
		).toBe('true');
	});
});
