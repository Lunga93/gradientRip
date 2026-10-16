// GET /api/posts/[id] — single post with author, presigned media GETs,
// ride card data, kudos + kudosed, comments count. Visibility-filtered with
// the migration's read rule (public | mine | friends-of-author | crew-member);
// anything else 404s so friends-only posts don't leak. Media URLs are minted ONLY
// for rows this query already proved visible — the server never mints them
// for anyone else.
//
// DELETE /api/posts/[id] — owner only (404 when missing, 403 when it is
// someone else's). Cascades post_media/post_kudos/transcode_jobs
// via FK; S3 objects deleted best-effort after the row delete.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { presignGet, deleteObjects } from '$lib/server/media.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The migration's posts_read rule, inlined so the 404 covers invisibility,
// plus the unfinished-post gate: processing/failed rows are author-only
// (spec §2 — a public post still processing must not leak its source media
// to strangers who guess the UUID). The crew branch
// (OR (visibility='crew' AND is_crew_member(crew_id))) is character-identical
// in every visibility expression across detail/feed/comments/kudos/retry/reports —
// copy-paste it, never rephrase.
const VISIBLE = `(p.visibility = 'public' OR p.author = current_user_id() OR (p.visibility = 'friends' AND is_friend(p.author)) OR (visibility='crew' AND is_crew_member(crew_id))) AND (p.status = 'live' OR p.author = current_user_id())`;

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid post id');
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT p.id, p.author, p.body, p.visibility, p.crew_id, p.ride_kind, p.ride_trip_id,
			        p.ride_route_id, p.status, p.hidden, p.kudos, p.created_at,
			        u.display_name AS author_name, u.avatar_url AS author_avatar,
			        (SELECT ch.name FROM channels ch WHERE ch.id = p.crew_id) AS crew_name,
			        EXISTS (SELECT 1 FROM post_kudos k WHERE k.post_id = p.id AND k.user_id = current_user_id()) AS kudosed,
			        (SELECT COUNT(*)::int FROM comments cm WHERE cm.feed_kind = 'post' AND cm.target_id = p.id) AS comments
			 FROM posts p LEFT JOIN users u ON u.id = p.author
			 WHERE p.id = $1 AND ${VISIBLE}`,
			[id]
		);
		if (rows.length === 0) throw error(404, 'Post not found');
		const post = rows[0];
		// Moderation read rule (Phase D Task 4): a hidden post (3 distinct
		// reporters) reads as missing for everyone except its author and the
		// crew admins of its crew — same 404 copy so hidden posts don't leak
		// existence. Authors keep full access (hidden banner + remedy); crew
		// admins keep access so the dismiss button has somewhere to live.
		const isAuthor = (post.author as string) === me.id;
		let viewerCanDismiss = false;
		if (post.visibility === 'crew' && (post.crew_id as string | null) !== null && !isAuthor) {
			// Members-PATCH admin gate verbatim (see the dismiss endpoint
			// header): active admin of the post's crew, else not privileged.
			const admin = await c.query(
				`SELECT role FROM channel_members
				 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
				[post.crew_id]
			);
			viewerCanDismiss = admin.rows.length > 0 && admin.rows[0].role === 'admin';
		}
		if (post.hidden === true && !isAuthor && !viewerCanDismiss) {
			throw error(404, 'Post not found');
		}
		// Report counts + reasons go ONLY to the author and crew admins —
		// strangers (even on a still-visible reported post) learn nothing
		// about its moderation state. Reporter identity is never exposed:
		// selected for the DISTINCT count only, stripped before responding.
		let moderation: {
			report_count: number;
			report_reasons: { id: string; reason: string; created_at: string }[];
			viewer_can_dismiss: boolean;
		} | null = null;
		if (isAuthor || viewerCanDismiss) {
			const { rows: reportRows } = await c.query(
				`SELECT id, reporter, reason, created_at FROM reports
				 WHERE target_kind = 'post' AND target_id = $1 ORDER BY created_at ASC`,
				[id]
			);
			moderation = {
				report_count: new Set(reportRows.map((r) => r.reporter as string)).size,
				report_reasons: reportRows.map((r) => ({
					id: r.id as string,
					reason: r.reason as string,
					created_at: (r.created_at as Date).toISOString()
				})),
				viewer_can_dismiss: viewerCanDismiss
			};
		}
		const { rows: mediaRows } = await c.query(
			`SELECT id, kind, s3_key, bytes FROM post_media WHERE post_id = $1 ORDER BY sort ASC`,
			[id]
		);
		// Ride card: stats visible to the post's audience (spec §2); opening
		// the full trip still requires its own visibility — no new access here.
		let ride: Record<string, unknown> | null = null;
		if (post.ride_kind === 'trip' && post.ride_trip_id !== null) {
			const found = await c.query('SELECT id, ts, mode_id, total_km FROM trips WHERE id = $1', [
				Number(post.ride_trip_id)
			]);
			if (found.rows.length > 0) {
				const t = found.rows[0];
				ride = {
					kind: 'trip',
					id: Number(t.id),
					ts: Number(t.ts),
					mode_id: t.mode_id as string,
					total_km: Number(t.total_km)
				};
			}
		} else if (post.ride_kind === 'route' && post.ride_route_id !== null) {
			const found = await c.query(
				'SELECT id, title, sport FROM public_routes WHERE id = $1 AND hidden = false',
				[post.ride_route_id]
			);
			if (found.rows.length > 0) {
				const r = found.rows[0];
				ride = { kind: 'route', id: r.id as string, title: r.title as string, sport: r.sport as string };
			}
		}
		return { post, mediaRows, ride, moderation };
	});
	const media = await Promise.all(
		data.mediaRows.map(async (r) => ({
			id: r.id as string,
			kind: r.kind as string,
			bytes: r.bytes as number,
			url: await presignGet(r.s3_key as string)
		}))
	);
	const p = data.post;
	return json(
		{
			id: p.id as string,
			author: {
				id: p.author as string,
				name: (p.author_name as string | null) ?? null,
				avatar: (p.author_avatar as string | null) ?? null
			},
			body: (p.body as string | null) ?? null,
			visibility: p.visibility as string,
			crew_id: (p.crew_id as string | null) ?? null,
			crew_name: (p.crew_name as string | null) ?? null,
			status: p.status as string,
			hidden: Boolean(p.hidden),
			// Privileged-only moderation (author + crew admins): absent for
			// strangers so moderation state never leaks to the audience.
			...(data.moderation ?? {}),
			ride: data.ride,
			kudos: Number(p.kudos) || 0,
			kudosed: Boolean(p.kudosed),
			comments: Number(p.comments) || 0,
			created_at: (p.created_at as Date).toISOString(),
			media
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};

export const DELETE: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid post id');
	const keys = await withUser(me.id, async (c) => {
		// Visibility first (same VISIBLE fragment as GET): invisible to the
		// caller reads as missing (404) so strangers cannot probe for
		// existing-but-invisible friends/processing posts; only a visible
		// foreign post (or own post) reaches the author-only 403 below.
		const found = await c.query('SELECT p.id, p.author FROM posts p WHERE p.id = $1 AND ' + VISIBLE, [id]);
		if (found.rows.length === 0) throw error(404, 'Post not found');
		if ((found.rows[0].author as string) !== me.id) throw error(403, 'You can only delete your own posts');
		const { rows: mediaRows } = await c.query('SELECT s3_key FROM post_media WHERE post_id = $1', [id]);
		// Polymorphic fan-out: comments/reports/notifications reference the
		// post by (kind, target_id) with no FK, so they survive the post
		// delete unless removed explicitly. Same txn = atomic.
		await c.query(`DELETE FROM comments WHERE feed_kind = 'post' AND target_id = $1`, [id]);
		await c.query(`DELETE FROM reports WHERE target_kind = 'post' AND target_id = $1`, [id]);
		await c.query(`DELETE FROM notifications WHERE feed_kind = 'post' AND target_id = $1`, [id]);
		// Row delete cascades post_media, post_kudos and transcode_jobs
		// (pending jobs die with the post — the worker's EXISTS guard also
		// skips orphaned queued rows).
		await c.query('DELETE FROM posts WHERE id = $1', [id]);
		return mediaRows.map((r) => r.s3_key as string);
	});
	if (keys.length > 0) {
		try {
			await deleteObjects(keys);
		} catch {
			/* rows are gone (URLs unmintable); orphaned bytes persist until the
			   sweeper follow-up lands (Phase C/D) — no bucket lifecycle expires them */
		}
	}
	return json({ ok: true, id }, { headers: { 'Cache-Control': 'no-store' } });
};
