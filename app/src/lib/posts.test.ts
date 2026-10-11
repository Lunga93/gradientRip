import { describe, expect, it } from 'vitest';
import { buildFeedCard } from './posts.svelte.js';

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
