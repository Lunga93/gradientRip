// GET /api/channels/[id]/feed — crew-scoped post feed (Phase C Task 5).
//
// Crew posts outside the shared /api/feed 50-item window are invisible to a
// client-side filter, so the crew Posts tab pages here instead: query params
// `limit` (default 20, max 50) + `before` (created_at ISO cursor, optional)
// + `beforeId` (post-id tie-break, optional). The cursor is the tuple
// (created_at, id): rows satisfy (p.created_at, p.id) < (before, beforeId)
// under ORDER BY created_at DESC, id DESC, so equal-timestamp rows straddling
// a page boundary are neither skipped nor duplicated. `before` is required
// for pages 2+; `beforeId` is optional for backward-compat with old clients
// and defaults to 'ffffffff-ffff-ffff-ffff-ffffffffffff' (a valid UUID that
// sorts after all real ids, so a before-only cursor re-includes same-timestamp
// rows — duplicates are possible for old clients, but no row is ever
// skipped). A `beforeId` without `before` is ignored (first page is
// unbounded). Returns { items } with post entries in the EXACT shape GET /api/feed
// returns for posts (same fields, same presigned-media handling, same
// processing-author-only rule — the post-row mapping below is copied from
// app/src/routes/api/feed/+server.ts, not re-derived), plus one additive
// `author_id` field so the crew page can pass real authorship to PostCard
// (PostCard needs no changes).
//
// Visibility gate FIRST: open crews serve any signed-in caller; private
// crews serve active members only (403 'Members only' — mirroring the
// members endpoint). Inside the crew, the row predicate mirrors the feed:
// crew+live rows iff the caller is an active member of the crew
// (OR (visibility='crew' AND is_crew_member(crew_id)) — character-identical
// to the feed fragment); own processing/failed rows always (author-only
// processing card). crew_id is only ever set when visibility is crew
// (POST /api/posts refuses it otherwise), so the public/friends branches
// are dead here but kept so the fragment stays copy-identical to the feed.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { presignGet } from '$lib/server/media.js';

// Mirror of the feed server's post-entry interfaces (canonical home:
// app/src/routes/api/feed/+server.ts). `author_id` is the one additive
// field beyond the feed shape (see header).
export interface CrewFeedPostMedia {
	kind: string;
	url: string;
}

export interface CrewFeedPostRideTrip {
	kind: 'trip';
	id: number;
	ts: number | null;
	mode_id: string | null;
	total_km: number | null;
}

export interface CrewFeedPostRideRoute {
	kind: 'route';
	id: string;
	title: string | null;
	sport: string | null;
}

export type CrewFeedPostRide = CrewFeedPostRideTrip | CrewFeedPostRideRoute;

export interface CrewFeedEntry {
	kind: 'post';
	id: string;
	title: string;
	kudos: number;
	created_at: string;
	sport: null;
	saves: number;
	rides: number;
	fit: null;
	start_at: null;
	going_count: number;
	channel: null;
	author_id: string;
	author_name: string | null;
	author_avatar: string | null;
	excerpt: string | null;
	status: string;
	visibility: string;
	crew_id: string | null;
	crew_name: string | null;
	media: CrewFeedPostMedia[];
	ride: CrewFeedPostRide | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
// Backward-compat default for a missing beforeId: the highest valid UUID
// string, so (created_at, id) < (before, max) keeps every same-timestamp row
// (duplicates possible for old before-only clients, never skips).
const BEFORE_ID_MAX = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const rawLimit = event.url.searchParams.get('limit');
	const rawBefore = event.url.searchParams.get('before');
	const rawBeforeId = event.url.searchParams.get('beforeId');
	let limit = DEFAULT_LIMIT;
	if (rawLimit !== null) {
		const parsed = Number.parseInt(rawLimit, 10);
		if (!Number.isFinite(parsed) || parsed < 1) throw error(400, 'limit must be a positive integer');
		limit = Math.min(parsed, MAX_LIMIT);
	}
	let before: string | null = null;
	if (rawBefore !== null && rawBefore.trim() !== '') {
		const ts = new Date(rawBefore).getTime();
		if (!Number.isFinite(ts)) throw error(400, 'Invalid before cursor');
		before = new Date(ts).toISOString();
	}
	let beforeId = BEFORE_ID_MAX;
	if (rawBeforeId !== null && rawBeforeId.trim() !== '') {
		if (!UUID_RE.test(rawBeforeId.trim())) throw error(400, 'Invalid beforeId cursor');
		beforeId = rawBeforeId.trim();
	}
	const items = await withUser(me.id, async (c) => {
		// Gate FIRST (mirrors the members endpoint): open → any signed-in
		// caller; private → active members only.
		const found = await c.query('SELECT id, visibility FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		if (found.rows[0].visibility !== 'open') {
			const member = await c.query(
				`SELECT 1 FROM channel_members
				 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
				[id]
			);
			if (member.rows.length === 0) throw error(403, 'Members only');
		}
		// Crew-scoped post rows: the feed's post predicate plus the crew
		// constraint (copied, not re-derived — cf. feed +server.ts).
		const params: unknown[] = [id];
		let cursor = '';
		if (before !== null) {
			// Tuple tie-break: equal-timestamp rows page by id, so no row
			// straddling a boundary is skipped or repeated.
			params.push(before, beforeId);
			cursor = `AND (p.created_at, p.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
		}
		params.push(limit);
		const posts = await c.query(
			`SELECT p.id, p.author AS author_id, p.body, LEFT(p.body, 140) AS excerpt, p.visibility, p.status,
			        p.kudos, p.created_at, p.crew_id, p.ride_kind, p.ride_trip_id, p.ride_route_id,
			        u.display_name AS author_name, u.avatar_url AS author_avatar,
			        (SELECT ch.name FROM channels ch WHERE ch.id = p.crew_id) AS crew_name
			 FROM posts p LEFT JOIN users u ON u.id = p.author
			 WHERE p.crew_id = $1 ${cursor}
			    AND ((p.status = 'live'
			          AND (p.visibility = 'public'
			               OR (p.visibility = 'friends' AND is_friend(p.author))
			               OR (visibility='crew' AND is_crew_member(crew_id))))
			         OR p.author = current_user_id())
			 ORDER BY p.created_at DESC, p.id DESC LIMIT $${params.length}`,
			params
		);
		const out: CrewFeedEntry[] = [];
		if (posts.rows.length === 0) return out;
		const ids = posts.rows.map((r) => r.id as string);
		const { rows: mediaRows } = await c.query(
			`SELECT post_id, kind, s3_key FROM post_media
			 WHERE post_id = ANY($1::uuid[]) ORDER BY sort ASC`,
			[ids]
		);
		// Ride card data, batched (same field list as GET /api/posts/[id]:
		// trip → id/ts/total_km, route → id/title/sport). Stats stay
		// visible to the post's audience; opening the full trip still
		// requires its own visibility — no new access here.
		const tripIds = [
			...new Set(
				posts.rows
					.filter((r) => r.ride_kind === 'trip' && r.ride_trip_id !== null)
					.map((r) => Number(r.ride_trip_id))
					.filter((n) => Number.isFinite(n))
			)
		];
		const routeIds = [
			...new Set(
				posts.rows
					.filter((r) => r.ride_kind === 'route' && r.ride_route_id !== null)
					.map((r) => r.ride_route_id as string)
			)
		];
		const tripById = new Map<number, { ts: number | null; mode_id: string | null; total_km: number | null }>();
		if (tripIds.length > 0) {
			const { rows: tripRows } = await c.query(
				`SELECT id, ts, mode_id, total_km FROM trips WHERE id = ANY($1::bigint[])`,
				[tripIds]
			);
			for (const t of tripRows) {
				const tripId = Number(t.id);
				if (!Number.isFinite(tripId)) continue;
				const ts = Number(t.ts);
				const totalKm = Number(t.total_km);
				tripById.set(tripId, {
					ts: Number.isFinite(ts) ? ts : null,
					mode_id: (t.mode_id as string | null) ?? null,
					total_km: Number.isFinite(totalKm) ? totalKm : null
				});
			}
		}
		const routeById = new Map<string, { title: string | null; sport: string | null }>();
		if (routeIds.length > 0) {
			const { rows: routeRows } = await c.query(
				`SELECT id, title, sport FROM public_routes WHERE id = ANY($1::uuid[]) AND hidden = false`,
				[routeIds]
			);
			for (const r of routeRows) {
				routeById.set(r.id as string, {
					title: (r.title as string | null) ?? null,
					sport: (r.sport as string | null) ?? null
				});
			}
		}
		const rideOf = (p: Record<string, unknown>): CrewFeedPostRide | null => {
			if (p.ride_kind === 'trip' && p.ride_trip_id !== null) {
				const rideId = Number(p.ride_trip_id);
				const found = tripById.get(rideId);
				if (found === undefined) return null;
				return { kind: 'trip', id: rideId, ts: found.ts, mode_id: found.mode_id, total_km: found.total_km };
			}
			if (p.ride_kind === 'route' && p.ride_route_id !== null) {
				const rideId = p.ride_route_id as string;
				const found = routeById.get(rideId);
				if (found === undefined) return null;
				return { kind: 'route', id: rideId, title: found.title, sport: found.sport };
			}
			return null;
		};
		const mediaByPost = new Map<string, { kind: string; url: string }[]>();
		for (const r of mediaRows) {
			const pid = r.post_id as string;
			if (!mediaByPost.has(pid)) mediaByPost.set(pid, []);
			mediaByPost.get(pid)?.push({ kind: r.kind as string, url: await presignGet(r.s3_key as string) });
		}
		for (const p of posts.rows) {
			const excerpt = (p.excerpt as string | null) ?? null;
			out.push({
				kind: 'post' as const,
				id: p.id as string,
				title: excerpt ?? '',
				kudos: Number(p.kudos) || 0,
				created_at: (p.created_at as Date).toISOString(),
				sport: null,
				saves: 0,
				rides: 0,
				fit: null,
				start_at: null,
				going_count: 0,
				channel: null,
				author_id: p.author_id as string,
				author_name: (p.author_name as string | null) ?? null,
				author_avatar: (p.author_avatar as string | null) ?? null,
				excerpt,
				status: p.status as string,
				visibility: p.visibility as string,
				crew_id: (p.crew_id as string | null) ?? null,
				crew_name: (p.crew_name as string | null) ?? null,
				media: mediaByPost.get(p.id as string) ?? [],
				ride: rideOf(p as Record<string, unknown>)
			});
		}
		return out;
	});
	return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};
