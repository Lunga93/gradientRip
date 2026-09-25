// GET /api/notifications — Phase 2 unread badge feed for comment/reply
// notifications fanned out by POST /api/comments. Returns the latest items
// plus the unread count; read via the partial idx_notifications_unread
// index. POST /api/notifications { ids? } marks read (all unread when ids
// is omitted; an explicit empty array marks nothing). Endpoints are live; the UI stays behind the feedPhase2 flag
// until Phase 1 is stable (cf. feed.svelte.ts). The live SSE friends feed
// is untouched — polling this endpoint for the badge suffices.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT n.id, n.kind, n.actor_id, n.feed_kind, n.target_id, n.comment_id,
			        n.read_at, n.created_at, u.display_name AS actor_name, u.avatar_url AS actor_avatar
			 FROM notifications n LEFT JOIN users u ON u.id = n.actor_id
			 WHERE n.user_id = current_user_id()
			 ORDER BY n.created_at DESC LIMIT 50`
		);
		const { rows: unreadRows } = await c.query(
			'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = current_user_id() AND read_at IS NULL'
		);
		return { items: rows, unread: Number(unreadRows[0]?.n) || 0 };
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const ids = Array.isArray(body?.ids) ? body.ids : null;
	if (ids !== null && !ids.every((v: unknown) => typeof v === 'string' && UUID_RE.test(v))) {
		throw error(400, 'ids must be notification UUIDs');
	}
	const data = await withUser(me.id, async (c) => {
		if (ids !== null && ids.length === 0) return { read: 0 };
		if (ids === null) {
			const { rowCount } = await c.query(
				`UPDATE notifications SET read_at = now()
				 WHERE user_id = current_user_id() AND read_at IS NULL`
			);
			return { read: rowCount ?? 0 };
		}
		const { rowCount } = await c.query(
			`UPDATE notifications SET read_at = now()
			 WHERE user_id = current_user_id() AND read_at IS NULL AND id = ANY($1::uuid[])`,
			[ids]
		);
		return { read: rowCount ?? 0 };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
