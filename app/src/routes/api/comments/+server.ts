// /api/comments — Phase 2 threaded comments on feed items (Task 8 kinds:
// 'activity'|'route'|'event', plus Phase B 'post'). Endpoints are live; the UI stays behind the
// feedPhase2 flag until Phase 1 is stable (cf. feed.svelte.ts).
//
// GET  /api/comments?kind=<kind>&id=<uuid> — flat list, created_at ASC;
//   the client threads via parent_id.
// POST /api/comments { kind, target_id, body, parent_id? } — validates with
//   parseComment, rate-limits to COMMENTS_PER_WINDOW per user per window
//   (429), then fans out notifications to the target owner + parent author.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { parseComment } from '$lib/community/comments.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['activity', 'route', 'event', 'post'] as const;

// One focused insert gate: at most this many comments per user per window.
const COMMENTS_PER_WINDOW = 10;
const WINDOW_INTERVAL = "interval '60 seconds'";

// Resolve the user to notify for a new comment on a visible target:
// route author / event creator / post author (iff the post is visible to the
// caller, else 404 — mirrors the event visibility branch). Null when there
// is nobody (activity has no rows in v1) or the target is not visible.
const findOwner = async (
	c: { query: (q: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
	kind: string,
	targetId: string
): Promise<string | null> => {
	if (kind === 'route') {
		const { rows } = await c.query(
			'SELECT author AS id FROM public_routes WHERE id = $1 AND hidden = false',
			[targetId]
		);
		if (rows.length === 0) throw error(404, 'Route not found');
		return rows[0].id as string;
	}
	if (kind === 'event') {
		const { rows } = await c.query(
			`SELECT e.created_by AS id FROM events e JOIN channels ch ON ch.id = e.channel_id
			 WHERE e.id = $1
			 AND (ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))`,
			[targetId]
		);
		if (rows.length === 0) throw error(404, 'Event not found');
		return rows[0].id as string;
	}
	if (kind === 'post') {
		const { rows } = await c.query(
			`SELECT p.author AS id FROM posts p WHERE p.id = $1
			 AND (p.visibility = 'public' OR p.author = current_user_id()
			    OR (p.visibility = 'friends' AND is_friend(p.author)))
			 AND (p.status = 'live' OR p.author = current_user_id())`,
			[targetId]
		);
		if (rows.length === 0) throw error(404, 'Post not found');
		return rows[0].id as string;
	}
	throw error(404, 'Activity not found');
};

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const kind = event.url.searchParams.get('kind') ?? '';
	const targetId = event.url.searchParams.get('id') ?? '';
	if (!(KINDS as readonly string[]).includes(kind)) {
		throw error(400, "kind must be 'activity', 'route', 'event' or 'post'");
	}
	if (!UUID_RE.test(targetId)) throw error(400, 'Invalid target id');
	const items = await withUser(me.id, async (c) => {
		await findOwner(c, kind, targetId);
		const { rows } = await c.query(
			`SELECT c.id, c.parent_id, c.body, c.user_id, c.created_at,
			        u.display_name, u.avatar_url
			 FROM comments c LEFT JOIN users u ON u.id = c.user_id
			 WHERE c.feed_kind = $1 AND c.target_id = $2
			 ORDER BY c.created_at ASC LIMIT 200`,
			[kind, targetId]
		);
		return rows;
	});
	return json({ items }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const kind = typeof body?.kind === 'string' ? body.kind : '';
	const targetId = typeof body?.target_id === 'string' ? body.target_id : '';
	const text = parseComment(body?.body);
	if (!(KINDS as readonly string[]).includes(kind)) {
		throw error(400, "kind must be 'activity', 'route', 'event' or 'post'");
	}
	if (!UUID_RE.test(targetId)) throw error(400, 'Invalid target id');
	if (text === null) throw error(400, 'body must be 1-500 chars');
	const parentId =
		body?.parent_id === undefined || body?.parent_id === null ? null : body.parent_id;
	if (parentId !== null && (typeof parentId !== 'string' || !UUID_RE.test(parentId))) {
		throw error(400, 'Invalid parent id');
	}
	const data = await withUser(me.id, async (c) => {
		const { rows: recent } = await c.query(
			`SELECT COUNT(*)::int AS n FROM comments
			 WHERE user_id = current_user_id() AND created_at > now() - ${WINDOW_INTERVAL}`
		);
		if (Number(recent[0]?.n) >= COMMENTS_PER_WINDOW) {
			throw error(429, 'Slow down — too many comments');
		}
		const owner = await findOwner(c, kind, targetId);
		let parentAuthor: string | null = null;
		if (parentId !== null) {
			const { rows: parents } = await c.query(
				'SELECT user_id FROM comments WHERE id = $1 AND feed_kind = $2 AND target_id = $3',
				[parentId, kind, targetId]
			);
			if (parents.length === 0) throw error(400, 'Parent comment is not on this target');
			parentAuthor = parents[0].user_id as string;
		}
		const { rows } = await c.query(
			`INSERT INTO comments (feed_kind, target_id, user_id, parent_id, body)
			 VALUES ($1, $2, current_user_id(), $3, $4)
			 RETURNING id, parent_id, body, created_at`,
			[kind, targetId, parentId, text]
		);
		const comment = rows[0];
		// Fan out: owner gets a 'comment', the replied-to author a 'reply'.
		// Skip self-notifies and dedupe when both recipients coincide.
		const recipients = new Map<string, string>();
		if (owner !== null && owner !== me.id) recipients.set(owner, 'comment');
		if (parentAuthor !== null && parentAuthor !== me.id && !recipients.has(parentAuthor)) {
			recipients.set(parentAuthor, 'reply');
		}
		for (const [recipient, nkind] of recipients) {
			await c.query(
				`INSERT INTO notifications (user_id, kind, actor_id, feed_kind, target_id, comment_id)
				 VALUES ($1, $2, current_user_id(), $3, $4, $5)`,
				[recipient, nkind, kind, targetId, comment.id]
			);
		}
		return { id: comment.id as string, created_at: comment.created_at as string };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
