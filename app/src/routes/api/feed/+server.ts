// GET /api/feed — Feed Phase 1 list combining public routes (with kudos
// from route_stats, cf. explore endpoint), upcoming events the caller can
// see (open + member-private channels, cf. events RSVP), and Phase B posts
// (public+live for all signed-in; friends+live iff author is me or friend;
// own processing/failed always). Shape
// { kind: 'activity'|'route'|'event'; id; title; kudos } is consumed by
// Task 9 comments. No 'activity' rows exist in v1 — the kind stays in the
// union as forward-compat.
//
// Task 9 enrichment (all additive, core shape untouched): routes carry
// sport/saves/rides + a server-computed `fit` badge (same thresholds as
// fitBadge(), cf. explore endpoint) and author name/avatar for the card
// header; events carry start_at/going_count + channel name and creator
// name/avatar. created_at backs relTime on both kinds.
import { json, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { fitBadge } from '$lib/community/scoring.js';
import { presignGet } from '$lib/server/media.js';

export interface FeedPostMedia {
	kind: string;
	url: string;
}

export interface FeedPostRideTrip {
	kind: 'trip';
	id: number;
	ts: number | null;
	total_km: number | null;
}

export interface FeedPostRideRoute {
	kind: 'route';
	id: string;
	title: string | null;
	sport: string | null;
}

export type FeedPostRide = FeedPostRideTrip | FeedPostRideRoute;

export interface FeedEntry {
	kind: 'activity' | 'route' | 'event' | 'post';
	id: string;
	title: string;
	kudos: number;
	created_at: string;
	sport: string | null;
	saves: number;
	rides: number;
	fit: 'fly' | 'ok' | 'caution' | 'stop' | null;
	start_at: string | null;
	going_count: number;
	channel: string | null;
	author_name: string | null;
	author_avatar: string | null;
	// Post-only fields (null for route/event entries): excerpt is the first
	// 140 chars of the body (title mirrors it so card shells keep working);
	// media holds presigned GETs minted ONLY for rows this caller can see.
	excerpt: string | null;
	status: string | null;
	visibility: string | null;
	media: FeedPostMedia[] | null;
	// Attached ride for post entries only (null for route/event rows and
	// posts without one). Field list mirrors GET /api/posts/[id]: trip →
	// id/ts/total_km, route → id/title/sport — exactly what PostCard's ride
	// card renders, nothing more.
	ride: FeedPostRide | null;
}

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const fitOf = (stats: unknown): FeedEntry['fit'] => {
	if (!stats || typeof stats !== 'object') return null;
	const st = stats as Record<string, unknown>;
	const vals = ['totalWh', 'usableWh', 'worstClimb', 'climbLimit', 'worstDescent', 'brakeLimit'].map(
		(k) => st[k]
	);
	if (!vals.every(isFiniteNum)) return null;
	const [totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit] = vals as number[];
	return fitBadge(totalWh, usableWh, worstClimb, climbLimit, worstDescent, brakeLimit);
};

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const items = await withUser(me.id, async (c) => {
		const routes = await c.query(
			`SELECT r.id, r.title, r.sport, r.stats, r.created_at,
				COALESCE(s.rides, 0)::int AS rides,
				COALESCE(s.saves, 0)::int AS saves,
				COALESCE(s.kudos, 0)::int AS kudos,
				u.display_name AS author_name, u.avatar_url AS author_avatar
			 FROM public_routes r LEFT JOIN route_stats s ON s.route_id = r.id
			 LEFT JOIN users u ON u.id = r.author
			 WHERE r.hidden = false
			 ORDER BY r.created_at DESC LIMIT 50`
		);
		const events = await c.query(
			`SELECT e.id, e.title, e.start_at, e.created_at, ch.name AS channel,
				(SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count,
				u.display_name AS author_name, u.avatar_url AS author_avatar
			 FROM events e JOIN channels ch ON ch.id = e.channel_id
			 LEFT JOIN users u ON u.id = e.created_by
			 WHERE e.start_at >= now() - interval '1 day'
			 AND (ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))
			 ORDER BY e.start_at ASC LIMIT 50`
		);
		const out: FeedEntry[] = [
			...routes.rows.map((r) => ({
				kind: 'route' as const,
				id: r.id as string,
				title: r.title as string,
				kudos: Number(r.kudos) || 0,
				created_at: (r.created_at as Date).toISOString(),
				sport: (r.sport as string | null) ?? null,
				saves: Number(r.saves) || 0,
				rides: Number(r.rides) || 0,
				fit: fitOf(r.stats),
				start_at: null,
				going_count: 0,
				channel: null,
				author_name: (r.author_name as string | null) ?? null,
				author_avatar: (r.author_avatar as string | null) ?? null,
				excerpt: null,
				status: null,
				visibility: null,
				media: null,
				ride: null
			})),
			...events.rows.map((e) => ({
				kind: 'event' as const,
				id: e.id as string,
				title: e.title as string,
				kudos: 0,
				created_at: (e.created_at as Date).toISOString(),
				sport: null,
				saves: 0,
				rides: 0,
				fit: null,
				start_at: (e.start_at as Date).toISOString(),
				going_count: Number(e.going_count) || 0,
				channel: (e.channel as string | null) ?? null,
				author_name: (e.author_name as string | null) ?? null,
				author_avatar: (e.author_avatar as string | null) ?? null,
				excerpt: null,
				status: null,
				visibility: null,
				media: null,
				ride: null
			}))
		];
		// Posts: public+live for every signed-in caller; friends+live iff the
		// author is me or a friend; my own processing/failed rows always (the
		// author-only processing card). Strangers never see friends-only or
		// unfinished rows — enforced here, in the same query that gates the
		// presigned media URLs below.
		const posts = await c.query(
			`SELECT p.id, p.body, LEFT(p.body, 140) AS excerpt, p.visibility, p.status,
			        p.kudos, p.created_at, p.ride_kind, p.ride_trip_id, p.ride_route_id,
			        u.display_name AS author_name, u.avatar_url AS author_avatar
			 FROM posts p LEFT JOIN users u ON u.id = p.author
			 WHERE (p.status = 'live'
			        AND (p.visibility = 'public'
			             OR (p.visibility = 'friends' AND is_friend(p.author))))
			    OR p.author = current_user_id()
			 ORDER BY p.created_at DESC LIMIT 50`
		);
		if (posts.rows.length > 0) {
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
			const tripById = new Map<number, { ts: number | null; total_km: number | null }>();
			if (tripIds.length > 0) {
				const { rows: tripRows } = await c.query(
					`SELECT id, ts, total_km FROM trips WHERE id = ANY($1::bigint[])`,
					[tripIds]
				);
				for (const t of tripRows) {
					const id = Number(t.id);
					if (!Number.isFinite(id)) continue;
					const ts = Number(t.ts);
					const totalKm = Number(t.total_km);
					tripById.set(id, {
						ts: Number.isFinite(ts) ? ts : null,
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
			const rideOf = (p: Record<string, unknown>): FeedPostRide | null => {
				if (p.ride_kind === 'trip' && p.ride_trip_id !== null) {
					const id = Number(p.ride_trip_id);
					const found = tripById.get(id);
					if (found === undefined) return null;
					return { kind: 'trip', id, ts: found.ts, total_km: found.total_km };
				}
				if (p.ride_kind === 'route' && p.ride_route_id !== null) {
					const id = p.ride_route_id as string;
					const found = routeById.get(id);
					if (found === undefined) return null;
					return { kind: 'route', id, title: found.title, sport: found.sport };
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
					author_name: (p.author_name as string | null) ?? null,
					author_avatar: (p.author_avatar as string | null) ?? null,
					excerpt,
					status: p.status as string,
					visibility: p.visibility as string,
					media: mediaByPost.get(p.id as string) ?? [],
					ride: rideOf(p as Record<string, unknown>)
				});
			}
		}
		out.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
		return out;
	});
	return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};
