// POST /api/reports { target_kind: 'route'|'event', target_id, reason } —
// inserts a moderation report. The trg_reports_autohide trigger hides a
// route once reports for it reach the threshold (3); no direct UPDATE here.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ['route', 'event'] as const;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const targetKind = typeof body?.target_kind === 'string' ? body.target_kind : '';
	const targetId = typeof body?.target_id === 'string' ? body.target_id : '';
	const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
	if (!(KINDS as readonly string[]).includes(targetKind)) {
		throw error(400, "target_kind must be 'route' or 'event'");
	}
	if (!UUID_RE.test(targetId)) throw error(400, 'Invalid target id');
	if (!reason || reason.length > 500) throw error(400, 'reason must be 1-500 chars');
	const data = await withUser(me.id, async (c) => {
		if (targetKind === 'route') {
			const found = await c.query('SELECT id FROM public_routes WHERE id = $1 AND hidden = false', [
				targetId
			]);
			if (found.rows.length === 0) throw error(404, 'Route not found');
		} else {
			const found = await c.query(
				`SELECT e.id FROM events e JOIN channels ch ON ch.id = e.channel_id WHERE e.id = $1
				 AND (ch.visibility = 'open'
				    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))`,
				[targetId]
			);
			if (found.rows.length === 0) throw error(404, 'Event not found');
		}
		const { rows } = await c.query(
			`INSERT INTO reports (target_kind, target_id, reporter, reason)
			 VALUES ($1, $2, current_user_id(), $3) RETURNING id`,
			[targetKind, targetId, reason]
		);
		return { id: rows[0].id as string };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
