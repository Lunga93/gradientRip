// POST /api/reports { target_kind: 'route'|'event'|'post', target_id, reason } —
// inserts a moderation report. The trg_reports_autohide trigger hides a
// route once reports for it reach the threshold (3); no direct UPDATE here.
// Event reports are rejected for now: there is no events.hidden column or
// hide branch in the trigger, so accepting them would be a no-op. Post
// reports are accepted and stored (UNIQUE per reporter), but likewise do NOT
// auto-hide: posts have no hidden column, so the trigger has no post branch.
// A post-moderation follow-up (hide/status threshold, Phase D scope) should
// extend the trigger before claiming threshold behaviour for posts.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['route', 'event', 'post'] as const;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const targetKind = typeof body?.target_kind === 'string' ? body.target_kind : '';
	const targetId = typeof body?.target_id === 'string' ? body.target_id : '';
	const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
	if (!(KINDS as readonly string[]).includes(targetKind)) {
		throw error(400, "target_kind must be 'route', 'event' or 'post'");
	}
	// No events.hidden column / trigger branch exists — accepting event
	// reports would store rows that never action. Reject explicitly until
	// the event-moderation follow-up lands.
	if (targetKind === 'event') {
		throw error(400, 'Event reports are not supported yet');
	}
	if (!UUID_RE.test(targetId)) throw error(400, 'Invalid target id');
	if (!reason || reason.length > 500) throw error(400, 'reason must be 1-500 chars');
	const data = await withUser(me.id, async (c) => {
		if (targetKind === 'route') {
			const found = await c.query('SELECT id FROM public_routes WHERE id = $1 AND hidden = false', [
				targetId
			]);
			if (found.rows.length === 0) throw error(404, 'Route not found');
		} else if (targetKind === 'post') {
			const found = await c.query(
				`SELECT id FROM posts p WHERE p.id = $1
				 AND (p.visibility = 'public' OR p.author = current_user_id()
				    OR (p.visibility = 'friends' AND is_friend(p.author)))
				 AND (p.status = 'live' OR p.author = current_user_id())`,
				[targetId]
			);
			if (found.rows.length === 0) throw error(404, 'Post not found');
		} else {
			const found = await c.query(
				`SELECT e.id FROM events e JOIN channels ch ON ch.id = e.channel_id WHERE e.id = $1
				 AND (ch.visibility = 'open'
				    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))`,
				[targetId]
			);
			if (found.rows.length === 0) throw error(404, 'Event not found');
		}
		let reportId: string;
		try {
			const { rows } = await c.query(
				`INSERT INTO reports (target_kind, target_id, reporter, reason)
				 VALUES ($1, $2, current_user_id(), $3) RETURNING id`,
				[targetKind, targetId, reason]
			);
			reportId = rows[0].id as string;
		} catch (e: unknown) {
			// UNIQUE(target_kind, target_id, reporter) — same user already reported this target.
			if (typeof e === 'object' && e !== null && (e as { code?: string }).code === '23505') {
				throw error(409, 'Already reported');
			}
			throw e;
		}
		return { id: reportId };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
