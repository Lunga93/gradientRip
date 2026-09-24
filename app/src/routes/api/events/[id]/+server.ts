// GET /api/events/[id]?invite= — preview-vs-full gate (consumed by Task 8
// feed cards). Everyone sees title/time/meetup + a blurred route (start
// point only); channel members and invite-link holders see the full route
// line plus the attendee list. POST { regenerate_invite: true } revokes the
// old link and issues a fresh invite_token (active channel members only).
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { previewRoute } from '$lib/community/privacy.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid event id');
	const invite = event.url.searchParams.get('invite') ?? '';
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT e.id, e.channel_id, e.title, e.start_at, e.meetup_lat, e.meetup_lon,
				e.route_id, e.capacity, e.invite_token, e.created_at,
				ch.visibility,
				EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active') AS is_member,
				r.title AS route_title, r.line AS route_line,
				(SELECT r2.status FROM event_rsvps r2 WHERE r2.event_id = e.id AND r2.user_id = current_user_id()) AS my_rsvp
			 FROM events e JOIN channels ch ON ch.id = e.channel_id
			 LEFT JOIN public_routes r ON r.id = e.route_id AND r.hidden = false
			 WHERE e.id = $1
			 AND (ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active'))`,
			[id]
		);
		if (rows.length === 0) throw error(404, 'Event not found');
		const row = rows[0];
		const isMember = Boolean(row.is_member);
		const hasLink = invite !== '' && invite === (row.invite_token as string);
		const preview = previewRoute({ isMember, hasLink });
		const line = (row.route_line as [number, number][] | null) ?? null;
		const base = {
			id: row.id as string,
			channel_id: row.channel_id as string,
			title: row.title as string,
			start_at: (row.start_at as Date).toISOString(),
			meetup_lat: (row.meetup_lat as number | null) ?? null,
			meetup_lon: (row.meetup_lon as number | null) ?? null,
			capacity: (row.capacity as number | null) ?? null,
			created_at: (row.created_at as Date).toISOString(),
			is_member: isMember,
			preview,
			my_rsvp: (row.my_rsvp as string | null) ?? null
		};
		if (preview) {
			return {
				...base,
				route:
					row.route_id && line
						? {
								id: row.route_id as string,
								title: (row.route_title as string) ?? '',
								preview: true as const,
								start: line[0] ?? null
							}
						: null
			};
		}
		const attendees = await c.query(
			`SELECT r.status, p.display_name
			 FROM event_rsvps r LEFT JOIN profiles p ON p.user_id = r.user_id
			 WHERE r.event_id = $1 ORDER BY r.status, p.display_name LIMIT 200`,
			[id]
		);
		return {
			...base,
			route:
				row.route_id && line
					? {
							id: row.route_id as string,
							title: (row.route_title as string) ?? '',
							preview: false as const,
							line
						}
					: null,
			attendees: attendees.rows.map((a) => ({
				status: a.status as string,
				display_name: (a.display_name as string | null) ?? 'Rider'
			}))
		};
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid event id');
	const body = await event.request.json().catch(() => null);
	if (body?.regenerate_invite !== true) throw error(400, 'Unknown action');
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, channel_id FROM events WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Event not found');
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[found.rows[0].channel_id]
		);
		if (member.rows.length === 0) throw error(403, 'Members only');
		const { rows } = await c.query(
			`UPDATE events SET invite_token = encode(gen_random_bytes(12), 'hex')
			 WHERE id = $1 RETURNING invite_token`,
			[id]
		);
		return { invite_token: rows[0].invite_token as string };
	});
	return json({ ok: true, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
