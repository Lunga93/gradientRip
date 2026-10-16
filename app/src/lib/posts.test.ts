import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildFeedCard, loadMyReports, dismissReports } from './posts.svelte.js';

const base = {
	id: '11111111-1111-4111-8111-111111111111',
	kudos: 3,
	created_at: new Date('2026-10-06T08:00:00Z').toISOString()
};

describe('buildFeedCard ride mapping', () => {
	it('maps a route ride row onto the card ride prop', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Morning loop',
			status: 'live',
			visibility: 'public',
			author_name: 'Lungy',
			author_avatar: null,
			media: [],
			ride: {
				kind: 'route',
				id: '22222222-2222-4222-8222-222222222222',
				title: 'Bay Loop',
				sport: 'eskate'
			}
		});
		expect(card.ride).toEqual({
			kind: 'route',
			id: '22222222-2222-4222-8222-222222222222',
			title: 'Bay Loop',
			sport: 'eskate'
		});
		expect(card.body).toBe('Morning loop');
	});

	it('maps a trip ride row onto the card ride prop', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Evening run',
			status: 'live',
			visibility: 'public',
			author_name: 'Lungy',
			author_avatar: null,
			media: [],
			ride: { kind: 'trip', id: 7, ts: 424242, total_km: 12.3 }
		});
		expect(card.ride).toEqual({
			kind: 'trip',
			id: 7,
			ts: 424242,
			mode_id: null,
			total_km: 12.3
		});
	});

	it('maps a missing ride to null', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Just words',
			status: 'live',
			visibility: 'public',
			author_name: 'Lungy',
			author_avatar: null,
			media: [],
			ride: null
		});
		expect(card.ride).toBeNull();
	});

	it('maps an absent ride field to null', () => {
		const card = buildFeedCard({ ...base, excerpt: 'Just words' });
		expect(card.ride).toBeNull();
	});

	it('carries crew audience fields onto the card for the chip', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Crew-only line',
			status: 'live',
			visibility: 'crew',
			crew_id: '33333333-3333-4333-8333-333333333333',
			crew_name: 'Dawn Patrol'
		});
		expect(card.visibility).toBe('crew');
		expect(card.crew_id).toBe('33333333-3333-4333-8333-333333333333');
		expect(card.crew_name).toBe('Dawn Patrol');
	});

	it('maps author_id onto card.author for authorship checks', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Mine',
			status: 'failed',
			author_id: '44444444-4444-4444-8444-444444444444',
			author_name: 'Lungy',
			author_avatar: null
		});
		expect(card.author).toEqual({
			id: '44444444-4444-4444-8444-444444444444',
			name: 'Lungy',
			avatar: null
		});
	});

	it('leaves card.author null when author_id is absent (shared-feed rows)', () => {
		const card = buildFeedCard({ ...base, excerpt: 'Just words' });
		expect(card.author).toBeNull();
	});
});

describe('buildFeedCard moderation passthrough', () => {
	it('carries hidden + counts + dismiss wiring onto the card', () => {
		const card = buildFeedCard({
			...base,
			excerpt: 'Crew night ride',
			status: 'live',
			visibility: 'crew',
			hidden: true,
			report_count: 3,
			report_reasons: [{ id: 'r1', reason: 'Spam', created_at: '2026-10-07T08:00:00Z' }],
			viewer_can_dismiss: true,
			dismiss_report_id: 'r1'
		});
		expect(card.hidden).toBe(true);
		expect(card.report_count).toBe(3);
		expect(card.report_reasons).toEqual([
			{ id: 'r1', reason: 'Spam', created_at: '2026-10-07T08:00:00Z' }
		]);
		expect(card.viewer_can_dismiss).toBe(true);
		expect(card.dismiss_report_id).toBe('r1');
	});

	it('defaults moderation fields to null when absent', () => {
		const card = buildFeedCard({ ...base, excerpt: 'Just words' });
		expect(card.hidden).toBeNull();
		expect(card.report_count).toBeNull();
		expect(card.report_reasons).toBeNull();
		expect(card.viewer_can_dismiss).toBeNull();
		expect(card.dismiss_report_id).toBeNull();
	});
});

describe('moderation fetch helpers', () => {
	const realFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = realFetch;
		vi.restoreAllMocks();
	});

	const resp = (status: number, data: unknown): Response =>
		({
			ok: status >= 200 && status < 300,
			status,
			json: async () => data
		}) as Response;

	it('loadMyReports returns the grouped targets', async () => {
		const seen: string[] = [];
		globalThis.fetch = (async (u: unknown) => {
			seen.push(String(u));
			return resp(200, {
				reports: [{ target_kind: 'post', target_id: 'p1', count: 2, hidden: false, reasons: [] }]
			});
		}) as unknown as typeof fetch;
		const res = await loadMyReports();
		expect(res.ok).toBe(true);
		expect(seen).toEqual(['/api/reports/mine']);
		expect(res.reports).toHaveLength(1);
	});

	it('loadMyReports reports 401 as signed-out', async () => {
		globalThis.fetch = (async () => resp(401, {})) as unknown as typeof fetch;
		const res = await loadMyReports();
		expect(res.ok).toBe(false);
		expect(res.message).toMatch(/sign in/i);
	});

	it('dismissReports POSTs to the report dismiss path', async () => {
		const seen: { url: string; method: string }[] = [];
		globalThis.fetch = (async (u: unknown, init?: { method?: string }) => {
			seen.push({ url: String(u), method: init?.method ?? '' });
			return resp(200, { ok: true, post_id: 'p1' });
		}) as unknown as typeof fetch;
		const res = await dismissReports('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
		expect(res.ok).toBe(true);
		expect(seen).toEqual([
			{ url: '/api/reports/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dismiss', method: 'POST' }
		]);
	});

	it('dismissReports surfaces server rejections honestly', async () => {
		globalThis.fetch = (async () =>
			resp(403, { message: 'Crew admins only' })) as unknown as typeof fetch;
		const res = await dismissReports('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
		expect(res.ok).toBe(false);
		expect(res.message).toBe('Crew admins only');
	});
});
