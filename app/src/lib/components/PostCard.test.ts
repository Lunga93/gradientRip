// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

const mockGoto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto: mockGoto }));

import PostCard from './PostCard.svelte';
import { feed, type FeedComment } from '$lib/feed.svelte.js';
import {
	COMMENT_MAX,
	threadComments,
	videoParts,
	type PostCardPost
} from '$lib/posts.svelte.js';

const POST_ID = '11111111-1111-4111-8111-111111111111';

const basePost = (over: Partial<PostCardPost> = {}): PostCardPost => ({
	id: POST_ID,
	body: 'Sunrise skate down the promenade.',
	status: 'live',
	visibility: 'public',
	kudos: 5,
	kudosed: false,
	comments: 0,
	created_at: new Date('2026-10-06T08:00:00Z').toISOString(),
	author_name: 'Priya',
	author_avatar: null,
	media: [],
	ride: null,
	...over
});

const comment = (over: Partial<FeedComment> = {}): FeedComment => ({
	id: 'c1',
	parent_id: null,
	body: 'Nice line!',
	user_id: 'user-lungy',
	display_name: 'Lungy',
	avatar_url: null,
	created_at: '2026-10-06T09:00:00Z',
	...over
});

type FetchHandler = (url: string, init?: RequestInit) => unknown;

const resp = (status: number, data: unknown): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		json: async () => data
	}) as Response;

const mockFetch = (handler: FetchHandler): ReturnType<typeof vi.fn> => {
	const fn = vi.fn(async (u: unknown, init?: unknown) => handler(String(u), init as RequestInit));
	globalThis.fetch = fn as unknown as typeof fetch;
	return fn;
};

const realFetch = globalThis.fetch;

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	globalThis.fetch = realFetch;
	feed.items = [];
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	mockGoto.mockClear();
});

describe('PostCard text variant', () => {
	it('renders the body and kudos count with a Comment button into detail', async () => {
		render(PostCard, { props: { post: basePost() } });
		expect(screen.getByText('Sunrise skate down the promenade.')).toBeTruthy();
		expect(screen.getByRole('button', { name: /give kudos/i })).toBeTruthy();
		expect(screen.getByRole('button', { name: /give kudos/i }).textContent).toContain('5');
		const commentBtn = screen.getByRole('button', { name: 'Comment on this post' });
		await fireEvent.click(commentBtn);
		expect(mockGoto).toHaveBeenCalledOnce();
		expect(String(mockGoto.mock.calls[0][0])).toContain(POST_ID);
	});

	it('clamps long text to 6 lines with a More link, short text has none', () => {
		const long = basePost({ body: 'x'.repeat(500) });
		const { unmount } = render(PostCard, { props: { post: long } });
		const more = screen.getByRole('link', { name: 'More' });
		expect(more.getAttribute('href')).toContain(POST_ID);
		unmount();
		cleanup();
		render(PostCard, { props: { post: basePost() } });
		expect(screen.queryByRole('link', { name: 'More' })).toBeNull();
	});

	it('renders full text with no More link and no Comment button on detail', () => {
		render(PostCard, { props: { post: basePost({ body: 'y'.repeat(500) }), detail: true } });
		expect(screen.queryByRole('link', { name: 'More' })).toBeNull();
		expect(screen.queryByRole('button', { name: 'Comment on this post' })).toBeNull();
	});
});

describe('PostCard detail author header', () => {
	it('renders avatar fallback, name and relative time on detail only', () => {
		const { container } = render(PostCard, { props: { post: basePost(), detail: true } });
		const header = container.querySelector('.post-author');
		expect(header).not.toBeNull();
		expect(header?.textContent).toContain('Priya');
		expect(header?.querySelectorAll('a')).toHaveLength(0);
	});

	it('renders no author header on the feed card', () => {
		const { container } = render(PostCard, { props: { post: basePost() } });
		expect(container.querySelector('.post-author')).toBeNull();
	});
});

describe('PostCard media variants', () => {
	it('renders a single photo large', () => {
		const { container } = render(
			PostCard,
			{ props: { post: basePost({ media: [{ kind: 'photo', url: 'https://cdn/p1.jpg' }] }) } }
		);
		const imgs = container.querySelectorAll('img');
		expect(imgs).toHaveLength(1);
		expect(imgs[0].getAttribute('src')).toBe('https://cdn/p1.jpg');
		expect(container.querySelector('.post-photo-grid')).toBeNull();
	});

	it('renders 2-4 photos as a grid', () => {
		const { container } = render(
			PostCard,
			{
				props: {
					post: basePost({
						media: [
							{ kind: 'photo', url: 'https://cdn/p1.jpg' },
							{ kind: 'photo', url: 'https://cdn/p2.jpg' },
							{ kind: 'photo', url: 'https://cdn/p3.jpg' }
						]
					})
				}
			}
		);
		expect(container.querySelectorAll('.post-photo-grid img')).toHaveLength(3);
	});

	it('plays the 480p rendition by default with poster, toggles to 720p', async () => {
		const { container } = render(
			PostCard,
			{
				props: {
					post: basePost({
						media: [
							{ kind: 'video', url: 'https://cdn/v-src.mp4' },
							{ kind: 'video', url: 'https://cdn/v-720.mp4' },
							{ kind: 'video', url: 'https://cdn/v-480.mp4' },
							{ kind: 'poster', url: 'https://cdn/poster.jpg' }
						]
					})
				}
			}
		);
		const video = container.querySelector('video') as HTMLVideoElement | null;
		expect(video).not.toBeNull();
		expect(video?.getAttribute('src')).toBe('https://cdn/v-480.mp4');
		expect(video?.getAttribute('poster')).toBe('https://cdn/poster.jpg');
		await fireEvent.click(screen.getByRole('button', { name: 'Switch video to 720p' }));
		expect(video?.getAttribute('src')).toBe('https://cdn/v-720.mp4');
		await fireEvent.click(screen.getByRole('button', { name: 'Switch video to 480p' }));
		expect(video?.getAttribute('src')).toBe('https://cdn/v-480.mp4');
	});
});

describe('PostCard ride card', () => {
	it('renders an attached route with an Open button into route detail', async () => {
		render(
			PostCard,
			{
				props: {
					post: basePost({
						ride: { kind: 'route', id: '22222222-2222-4222-8222-222222222222', title: 'Bay Loop', sport: 'eskate' }
					})
				}
			}
		);
		expect(screen.getByText(/Bay Loop/)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: /open attached route/i }));
		expect(mockGoto).toHaveBeenCalledOnce();
		expect(String(mockGoto.mock.calls[0][0])).toContain('22222222-2222-4222-8222-222222222222');
	});

	it('renders an attached trip with stats and honest copy when it is not on this device', async () => {
		render(
			PostCard,
			{ props: { post: basePost({ ride: { kind: 'trip', id: 7, ts: 424242, mode_id: 'eskate', total_km: 12.3 } }) } }
		);
		expect(screen.getByText(/12\.3 km/)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Open attached trip' }));
		expect(screen.getByText(/isn't on this device/)).toBeTruthy();
		expect(mockGoto).not.toHaveBeenCalled();
	});
});

describe('PostCard processing / failed states', () => {
	it('shows processing copy without retry for non-authors', () => {
		render(PostCard, { props: { post: basePost({ status: 'processing' }), isAuthor: false } });
		expect(screen.getByText(/being processed/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
	});

	it('shows processing copy without retry even for the author (failed-only rule)', () => {
		render(PostCard, { props: { post: basePost({ status: 'processing' }), isAuthor: true } });
		expect(screen.getByText(/being processed/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
	});

	it('shows failed copy without retry for non-authors', () => {
		render(PostCard, { props: { post: basePost({ status: 'failed' }), isAuthor: false } });
		expect(screen.getByText(/processing failed/)).toBeTruthy();
		expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
	});

	it('shows failed copy with author retry that surfaces the server message', async () => {
		mockFetch((url) =>
			url.includes('/retry') ? resp(422, { message: 'Video is still being processed — please wait' }) : resp(404, {})
		);
		render(PostCard, { props: { post: basePost({ status: 'failed' }), isAuthor: true } });
		expect(screen.getByText(/processing failed/)).toBeTruthy();
		await fireEvent.click(screen.getByRole('button', { name: 'Retry video processing' }));
		expect(await screen.findByText('Video is still being processed — please wait')).toBeTruthy();
	});

	it('renders no video player on a failed post — the source never produced playable output', () => {
		const { container } = render(
			PostCard,
			{
				props: {
					post: basePost({
						status: 'failed',
						media: [{ kind: 'video', url: 'https://cdn/v-src.mp4' }]
					}),
					isAuthor: true
				}
			}
		);
		expect(screen.getByText(/processing failed/)).toBeTruthy();
		expect(container.querySelector('video')).toBeNull();
	});

	it('keeps the playable source on a processing post alongside the processing note', () => {
		const { container } = render(
			PostCard,
			{
				props: {
					post: basePost({
						status: 'processing',
						media: [{ kind: 'video', url: 'https://cdn/v-src.mp4' }]
					}),
					isAuthor: true
				}
			}
		);
		expect(screen.getByText(/being processed/)).toBeTruthy();
		expect(container.querySelector('video')).not.toBeNull();
	});
});

describe('PostCard thread + composer', () => {
	const threaded: FeedComment[] = [
		comment({ id: 'c1', parent_id: null, body: 'Top-level cheer' }),
		comment({ id: 'c2', parent_id: 'c1', body: 'Nested reply', display_name: 'Priya' })
	];

	it('renders nested replies indented under their parent', () => {
		const { container } = render(PostCard, { props: { post: basePost(), detail: true, comments: threaded } });
		expect(screen.getByText('Top-level cheer')).toBeTruthy();
		expect(screen.getByText('Nested reply')).toBeTruthy();
		expect(container.querySelectorAll('.thread-reply')).toHaveLength(1);
		expect(container.querySelector('.thread-reply')?.textContent).toContain('Nested reply');
	});

	it('composer enforces 500 chars with a live counter and blocks empty submits', async () => {
		render(PostCard, { props: { post: basePost(), detail: true, comments: [] } });
		const box = screen.getByLabelText(/write a comment/i) as HTMLTextAreaElement;
		expect(box.getAttribute('maxlength')).toBe(String(COMMENT_MAX));
		expect(screen.getByText('0/500')).toBeTruthy();
		expect(screen.getByRole('button', { name: /submit comment/i }).hasAttribute('disabled')).toBe(true);
		await fireEvent.input(box, { target: { value: 'z'.repeat(COMMENT_MAX) } });
		expect(screen.getByText('500/500')).toBeTruthy();
	});

	it('submits top-level comments and replies with the right parent', async () => {
		const seen: { url: string; body: unknown }[] = [];
		mockFetch((url, init) => {
			seen.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
			if (url.includes('/api/comments') && init?.method === 'POST') {
				return resp(200, { ok: true, id: 'c9', created_at: new Date().toISOString() });
			}
			return resp(200, { items: [] });
		});
		render(PostCard, { props: { post: basePost(), detail: true, comments: threaded } });
		await fireEvent.click(screen.getByRole('button', { name: 'Reply to Lungy' }));
		expect(screen.getByText(/replying to lungy/i)).toBeTruthy();
		const box = screen.getByLabelText(/write a comment/i) as HTMLTextAreaElement;
		await fireEvent.input(box, { target: { value: 'On it!' } });
		await fireEvent.click(screen.getByRole('button', { name: /submit comment/i }));
		await vi.waitFor(() => {
			const posts = seen.filter((s) => s.url.includes('/api/comments'));
			expect(posts.length).toBeGreaterThan(0);
		});
		const sent = seen.find((s) => s.url.includes('/api/comments'))?.body as Record<string, unknown>;
		expect(sent.target_id).toBe(POST_ID);
		expect(sent.parent_id).toBe('c1');
		expect(sent.body).toBe('On it!');
	});
});

describe('PostCard kudos rollback', () => {
	it('reverts the optimistic +1 when the request fails', async () => {
		const item = { id: POST_ID, kudos: 5 };
		mockFetch(() => {
			throw new Error('down');
		});
		const res = await feed.givePostKudos(item);
		expect(res.ok).toBe(false);
		expect(item.kudos).toBe(5);
	});

	it('adopts the server count on success', async () => {
		const item = { id: POST_ID, kudos: 5 };
		mockFetch(() => resp(200, { kudosed: true, kudos: 6 }));
		const res = await feed.givePostKudos(item);
		expect(res.ok).toBe(true);
		expect(item.kudos).toBe(6);
	});
});

describe('PostCard reports', () => {
	it('sends a post report with an accepted kind and shows thanks copy', async () => {
		const seen: unknown[] = [];
		mockFetch((url, init) => {
			if (url.includes('/api/reports')) {
				seen.push(init?.body ? JSON.parse(String(init.body)) : null);
				return resp(200, { ok: true, id: 'r1' });
			}
			return resp(404, {});
		});
		render(PostCard, { props: { post: basePost() } });
		await fireEvent.click(screen.getByRole('button', { name: 'Report this post' }));
		await fireEvent.input(screen.getByLabelText(/report reason/i), { target: { value: 'Spam' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Send report' }));
		expect(await screen.findByText('Thanks — report received')).toBeTruthy();
		expect(seen[0]).toMatchObject({ target_kind: 'post', target_id: POST_ID, reason: 'Spam' });
	});
});

describe('PostCard author delete', () => {
	it('confirms then deletes and returns home', async () => {
		vi.stubGlobal('confirm', vi.fn(() => true));
		mockFetch((url) => (url.includes(`/api/posts/${POST_ID}`) ? resp(200, { ok: true, id: POST_ID }) : resp(404, {})));
		render(PostCard, { props: { post: basePost(), detail: true, isAuthor: true } });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete this post' }));
		expect(mockGoto).toHaveBeenCalledOnce();
		expect(String(mockGoto.mock.calls[0][0])).toBe('/home');
	});

	it('does not delete when the confirm is dismissed', async () => {
		vi.stubGlobal('confirm', vi.fn(() => false));
		const fetchFn = mockFetch(() => resp(200, { ok: true }));
		render(PostCard, { props: { post: basePost(), detail: true, isAuthor: true } });
		await fireEvent.click(screen.getByRole('button', { name: 'Delete this post' }));
		expect(fetchFn).not.toHaveBeenCalled();
		expect(mockGoto).not.toHaveBeenCalled();
	});
});

describe('posts helpers', () => {
	it('threadComments nests by parent and lifts dangling replies to root', () => {
		const flat: FeedComment[] = [
			comment({ id: 'a', parent_id: null, created_at: '2026-10-06T09:02:00Z' }),
			comment({ id: 'b', parent_id: 'a', created_at: '2026-10-06T09:03:00Z' }),
			comment({ id: 'c', parent_id: 'missing', created_at: '2026-10-06T09:01:00Z' })
		];
		const roots = threadComments(flat);
		expect(roots.map((r) => r.id)).toEqual(['c', 'a']);
		expect(roots[1].replies.map((r) => r.id)).toEqual(['b']);
	});

	it('videoParts defaults to 480p with a 720p toggle and poster', () => {
		const parts = videoParts([
			{ kind: 'video', url: 'src' },
			{ kind: 'video', url: 'hd' },
			{ kind: 'video', url: 'sd' },
			{ kind: 'poster', url: 'poster' },
			{ kind: 'photo', url: 'p1' }
		]);
		expect(parts.sd?.url).toBe('sd');
		expect(parts.hd?.url).toBe('hd');
		expect(parts.poster?.url).toBe('poster');
		expect(parts.photos.map((p) => p.url)).toEqual(['p1']);
	});
});
