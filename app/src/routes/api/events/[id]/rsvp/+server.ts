// POST /api/events/[id]/rsvp { status: 'going'|'interested'|'cant_go',
// invite? } — idempotent upsert (one row per user; repeat posts overwrite).
// The caller must be an active channel member or present the event's invite
// token (link RSVP for non-members of open-channel events).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATUSES = ['going', 'interested', 'cant_go'] as const;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid event id');
	const body = await event.request.json().catch(() => null);
	const status = typeof body?.status === 'string' ? body.status : '';
	if (!(STATUSES as readonly string[]).includes(status)) {
		throw error(400, "status must be 'going', 'interested' or 'cant_go'");
	}
	const invite = typeof body?.invite === 'string' ? body.invite : '';
	const data = await withUser(me.id, async (c) => {
		const found = await c.query(
			`SELECT e.id, e.channel_id, e.capacity, e.invite_token, ch.visibility
			 FROM events e JOIN channels ch ON ch.id = e.channel_id WHERE e.id = $1`,
			[id]
		);
		if (found.rows.length === 0) throw error(404, 'Event not found');
		const row = found.rows[0];
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[row.channel_id]
		);
		const isMember = member.rows.length > 0;
		const hasLink = invite !== '' && invite === (row.invite_token as string);
		if (!isMember && !hasLink) throw error(403, 'Join the channel or use the invite link to RSVP');
		if (status === 'going' && row.capacity !== null) {
			const { rows } = await c.query(
				`SELECT COUNT(*)::int AS n FROM event_rsvps
				 WHERE event_id = $1 AND status = 'going' AND user_id <> current_user_id()`,
				[id]
			);
			if (Number(rows[0]?.n) >= Number(row.capacity)) throw error(409, 'Event is full');
		}
		await c.query(
			`INSERT INTO event_rsvps (event_id, user_id, status)
			 VALUES ($1, current_user_id(), $2)
			 ON CONFLICT (event_id, user_id) DO UPDATE SET status = EXCLUDED.status`,
			[id, status]
		);
		const counts = await c.query(
			`SELECT status, COUNT(*)::int AS n FROM event_rsvps WHERE event_id = $1 GROUP BY status`,
			[id]
		);
		const byStatus: Record<string, number> = { going: 0, interested: 0, cant_go: 0 };
		for (const r of counts.rows) byStatus[r.status as string] = Number(r.n) || 0;
		return { status, ...byStatus };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
