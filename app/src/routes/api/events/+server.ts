// /api/events — GET lists events in channels readable by the caller (open +
// member private). POST { channel_id, title, start_at, meetup_lat?,
// meetup_lon?, route_id?, capacity? } creates one; the caller must be an
// active member of the channel. invite_token defaults from the DB.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT e.id, e.channel_id, e.title, e.start_at, e.meetup_lat, e.meetup_lon,
				e.route_id, e.capacity, e.created_at,
				EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active') AS is_member,
				(SELECT COUNT(*)::int FROM event_rsvps r WHERE r.event_id = e.id AND r.status = 'going') AS going_count
			 FROM events e JOIN channels ch ON ch.id = e.channel_id
			 WHERE ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = e.channel_id AND m.user_id = current_user_id() AND m.status = 'active')
			 ORDER BY e.start_at ASC LIMIT 200`
		);
		return {
			events: rows.map((r) => ({
				id: r.id as string,
				channel_id: r.channel_id as string,
				title: r.title as string,
				start_at: (r.start_at as Date).toISOString(),
				meetup_lat: (r.meetup_lat as number | null) ?? null,
				meetup_lon: (r.meetup_lon as number | null) ?? null,
				route_id: (r.route_id as string | null) ?? null,
				capacity: (r.capacity as number | null) ?? null,
				created_at: (r.created_at as Date).toISOString(),
				is_member: Boolean(r.is_member),
				going_count: Number(r.going_count) || 0
			}))
		};
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const channelId = typeof body?.channel_id === 'string' ? body.channel_id : '';
	const title = typeof body?.title === 'string' ? body.title.trim() : '';
	const startAt = typeof body?.start_at === 'string' ? body.start_at : '';
	const meetupLat = body?.meetup_lat === null || body?.meetup_lat === undefined ? null : Number(body.meetup_lat);
	const meetupLon = body?.meetup_lon === null || body?.meetup_lon === undefined ? null : Number(body.meetup_lon);
	const routeId = typeof body?.route_id === 'string' && body.route_id ? body.route_id : null;
	const capacityRaw = body?.capacity === null || body?.capacity === undefined ? null : Number(body.capacity);
	if (!UUID_RE.test(channelId)) throw error(400, 'Invalid channel id');
	if (!title || title.length > 80) throw error(400, 'Event title must be 1–80 characters');
	const start = new Date(startAt);
	if (!startAt || Number.isNaN(start.getTime())) throw error(400, 'start_at must be a valid date');
	if (meetupLat !== null && (!Number.isFinite(meetupLat) || meetupLat < -90 || meetupLat > 90)) {
		throw error(400, 'meetup_lat must be in [-90, 90]');
	}
	if (meetupLon !== null && (!Number.isFinite(meetupLon) || meetupLon < -180 || meetupLon > 180)) {
		throw error(400, 'meetup_lon must be in [-180, 180]');
	}
	if (routeId !== null && !UUID_RE.test(routeId)) throw error(400, 'Invalid route id');
	let capacity: number | null = null;
	if (capacityRaw !== null) {
		if (!Number.isInteger(capacityRaw) || capacityRaw < 2) throw error(400, 'capacity must be an integer >= 2');
		capacity = capacityRaw;
	}
	const created = await withUser(me.id, async (c) => {
		const member = await c.query(
			`SELECT 1 FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[channelId]
		);
		if (member.rows.length === 0) throw error(403, 'Join the channel before creating events');
		if (routeId !== null) {
			const found = await c.query('SELECT id FROM public_routes WHERE id = $1 AND hidden = false', [routeId]);
			if (found.rows.length === 0) throw error(404, 'Route not found');
		}
		const { rows } = await c.query(
			`INSERT INTO events (channel_id, title, start_at, meetup_lat, meetup_lon, route_id, capacity, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, current_user_id())
			 RETURNING id, channel_id, title, start_at, meetup_lat, meetup_lon, route_id, capacity, invite_token, created_at`,
			[channelId, title, start.toISOString(), meetupLat, meetupLon, routeId, capacity]
		);
		const row = rows[0];
		return {
			id: row.id as string,
			channel_id: row.channel_id as string,
			title: row.title as string,
			start_at: (row.start_at as Date).toISOString(),
			meetup_lat: (row.meetup_lat as number | null) ?? null,
			meetup_lon: (row.meetup_lon as number | null) ?? null,
			route_id: (row.route_id as string | null) ?? null,
			capacity: (row.capacity as number | null) ?? null,
			invite_token: row.invite_token as string,
			created_at: (row.created_at as Date).toISOString()
		};
	});
	return json({ ok: true, event: created }, { headers: { 'Cache-Control': 'no-store' } });
};
