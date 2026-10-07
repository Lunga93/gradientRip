// Phase B post UI helpers + thin store (Task 6).
//
// Comment SHAPES extend feed.svelte.ts (ThreadNode extends FeedComment) and
// comment STATE is never forked: load/post always delegate to the feed store
// (`feed.comments`), which is the single cache. Post detail/rows live in page
// or card-local state — there is no parallel post cache here.
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { feed, type FeedComment } from './feed.svelte.js';
import { domain } from './state/domain.svelte.js';
import { loadTrip } from './planner.svelte.js';
import type { Trip } from './storage.js';

export const COMMENT_MAX = 500;
// Card text clamps at 6 lines; the More link appears past ~120 chars. The
// feed only carries 140-char excerpts, so full-length excerpts link out to
// the complete body on detail while short posts (shown whole) get no link.
export const MORE_CHARS = 120;

export interface PostCardMedia {
	kind: string;
	url: string;
}

export interface PostRideTrip {
	kind: 'trip';
	id: number;
	ts?: number | null;
	mode_id?: string | null;
	total_km?: number | null;
}

export interface PostRideRoute {
	kind: 'route';
	id: string;
	title?: string | null;
	sport?: string | null;
}

export type PostCardRide = PostRideTrip | PostRideRoute;

// Superset covering both shapes that render a card: the /api/feed excerpt
// rows (body = 140-char excerpt, no ride — the feed query does not select it)
// and the full /api/posts/[id] rows.
export interface PostCardPost {
	id: string;
	body: string | null;
	status: string | null;
	visibility?: string | null;
	kudos: number;
	kudosed?: boolean;
	comments?: number;
	created_at: string;
	author_name?: string | null;
	author_avatar?: string | null;
	author?: { id: string; name: string | null; avatar: string | null } | null;
	media?: PostCardMedia[] | null;
	ride?: PostCardRide | null;
}

export interface PostDetail extends PostCardPost {
	author: { id: string; name: string | null; avatar: string | null };
}

export interface ThreadNode extends FeedComment {
	replies: ThreadNode[];
}

// Flat created_at-ASC list → nested thread. Dangling parent_ids (parent on
// another target, deleted) lift to root rather than vanishing.
export function threadComments(flat: FeedComment[]): ThreadNode[] {
	const byId: Record<string, ThreadNode> = {};
	for (const c of flat) byId[c.id] = { ...c, replies: [] };
	const roots: ThreadNode[] = [];
	for (const c of flat) {
		const node = byId[c.id];
		if (!node) continue;
		const parent = c.parent_id ? byId[c.parent_id] : undefined;
		if (parent && parent.id !== node.id) parent.replies.push(node);
		else roots.push(node);
	}
	const byTime = (a: ThreadNode, b: ThreadNode): number =>
		a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
	const sortDeep = (nodes: ThreadNode[]): void => {
		nodes.sort(byTime);
		for (const n of nodes) sortDeep(n.replies);
	};
	sortDeep(roots);
	return roots;
}

export interface VideoParts {
	photos: PostCardMedia[];
	sd: PostCardMedia | null;
	hd: PostCardMedia | null;
	poster: PostCardMedia | null;
}

// Split post_media rows for the card. The transcode worker appends 720p, then
// 480p, then the poster AFTER the source row (post_media.sort ASC), so the
// last video row is the 480p default and the second-to-last the 720p toggle.
// Single-video posts (still processing, or worker output pending) play as-is
// with no quality toggle.
export function videoParts(media: PostCardMedia[] | null | undefined): VideoParts {
	const rows = Array.isArray(media) ? media : [];
	const photos = rows.filter((m) => m.kind === 'photo');
	const videos = rows.filter((m) => m.kind === 'video');
	const poster = rows.find((m) => m.kind === 'poster') ?? null;
	if (videos.length === 0) return { photos, sd: null, hd: null, poster };
	if (videos.length === 1) return { photos, sd: videos[0], hd: null, poster };
	return { photos, sd: videos[videos.length - 1], hd: videos[videos.length - 2], poster };
}

const readMessage = async (res: Response, fallback: string): Promise<string> => {
	try {
		const data = (await res.json()) as { message?: unknown };
		if (typeof data.message === 'string' && data.message.trim()) return data.message;
	} catch {
		/* non-JSON error body — fall through */
	}
	return `${fallback} (HTTP ${res.status})`;
};

export async function loadPost(id: string): Promise<{ ok: boolean; post?: PostDetail; message: string }> {
	try {
		const res = await fetch(`/api/posts/${encodeURIComponent(id)}`);
		if (res.status === 404) return { ok: false, message: 'Post not found.' };
		if (res.status === 401) return { ok: false, message: 'Sign in to see this post.' };
		if (!res.ok) return { ok: false, message: await readMessage(res, 'Could not load this post') };
		const post = (await res.json()) as PostDetail;
		return { ok: true, post, message: '' };
	} catch {
		return { ok: false, message: 'Could not load this post — check your connection.' };
	}
}

// Author-only requeue of a failed video job. Surfaces the endpoint's honest
// 422 copy verbatim (still processing / over 60s / attempts burned).
export async function retryPost(id: string): Promise<{ ok: boolean; message: string }> {
	try {
		const res = await fetch(`/api/posts/${encodeURIComponent(id)}/retry`, { method: 'POST' });
		if (!res.ok) return { ok: false, message: await readMessage(res, 'Could not retry the video') };
		return { ok: true, message: 'Video queued for another try — check back in a bit.' };
	} catch {
		return { ok: false, message: 'Could not retry the video — check your connection.' };
	}
}

export async function deletePost(id: string): Promise<{ ok: boolean; message: string }> {
	try {
		const res = await fetch(`/api/posts/${encodeURIComponent(id)}`, { method: 'DELETE' });
		if (!res.ok) return { ok: false, message: await readMessage(res, 'Could not delete the post') };
		return { ok: true, message: '' };
	} catch {
		return { ok: false, message: 'Could not delete the post — check your connection.' };
	}
}

// Same share pattern as the home feed: native sheet when available, else the
// post URL onto the clipboard with a "Link copied" note.
export async function sharePost(
	id: string,
	title: string
): Promise<{ ok: boolean; copied: boolean; message: string }> {
	const url = `${location.origin}${resolve(`/post/${id}` as `/post/${string}`)}`;
	try {
		if (typeof navigator.share === 'function') {
			await navigator.share({ title, url });
			return { ok: true, copied: false, message: '' };
		}
		if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
			await navigator.clipboard.writeText(url);
			return { ok: true, copied: true, message: 'Link copied' };
		}
		return { ok: false, copied: false, message: 'Sharing is not available here' };
	} catch {
		/* sheet dismissed or clipboard denied — stay silent like the feed */
		return { ok: false, copied: false, message: '' };
	}
}

// --- Comment delegation (single cache: feed.comments, kind 'post') ---

export function commentsFor(id: string): FeedComment[] {
	return feed.commentsFor(id);
}

export async function loadPostComments(id: string): Promise<void> {
	await feed.loadComments('post', id);
}

export async function submitPostComment(
	id: string,
	body: string,
	parentId: string | null
): Promise<{ ok: boolean; message: string }> {
	return feed.postComment('post', id, body, parentId);
}

export async function reportPost(id: string, reason: string): Promise<{ ok: boolean; message: string }> {
	return feed.report('post', id, reason);
}

export async function reportRoute(id: string, reason: string): Promise<{ ok: boolean; message: string }> {
	return feed.report('route', id, reason);
}

// Trip rides have no detail route/endpoint (GET /api/trips/[id] is
// delete-only), so Open works off the device's own saved trips, matched by
// the trip timestamp the post carries. Anything else gets honest copy, never
// a dead navigation.
export function findLocalTrip(ts: number | null | undefined): Trip | undefined {
	if (typeof ts !== 'number' || !Number.isFinite(ts)) return undefined;
	return domain.trips.find((t) => Number(t.ts) === ts);
}

export async function openTripRide(ride: PostRideTrip): Promise<{ ok: boolean; message: string }> {
	const trip = findLocalTrip(typeof ride.ts === 'number' ? ride.ts : Number(ride.ts));
	if (!trip) {
		return { ok: false, message: "This trip isn't on this device — open it from Saved trips where it was recorded." };
	}
	// Same open path as SavedTrips.openTrip: loadTrip renders onto the map,
	// which isn't mounted here — that throw still lands on /ride.
	try {
		loadTrip(trip);
	} catch (err) {
		const msg = err instanceof Error ? err.message : '';
		if (!msg.includes('Map not initialised')) {
			return { ok: false, message: 'Could not open this trip — try again from Saved trips.' };
		}
		await goto(resolve('/ride'));
	}
	return { ok: true, message: '' };
}
