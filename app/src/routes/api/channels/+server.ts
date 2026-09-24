// /api/channels — GET lists channels readable by the caller (open + member
// private). POST { name, visibility, sport?, home_area? } creates one and
// auto-joins the creator as owner.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { parseSports } from '$lib/profiles/profile.js';

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT ch.id, ch.name, ch.visibility, ch.sport, ch.home_area, ch.created_at,
				EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active') AS is_member,
				(SELECT COUNT(*)::int FROM channel_members m WHERE m.channel_id = ch.id AND m.status = 'active') AS member_count
			 FROM channels ch
			 WHERE ch.visibility = 'open'
			    OR EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active')
			 ORDER BY ch.created_at DESC LIMIT 200`
		);
		return {
			channels: rows.map((r) => ({
				id: r.id as string,
				name: r.name as string,
				visibility: r.visibility as 'open' | 'private',
				sport: (r.sport as string | null) ?? null,
				home_area: (r.home_area as string | null) ?? null,
				created_at: (r.created_at as Date).toISOString(),
				is_member: Boolean(r.is_member),
				member_count: Number(r.member_count) || 0
			}))
		};
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const name = typeof body?.name === 'string' ? body.name.trim() : '';
	const visibility = typeof body?.visibility === 'string' ? body.visibility : '';
	const sportRaw = typeof body?.sport === 'string' && body.sport ? body.sport : null;
	const homeArea = typeof body?.home_area === 'string' && body.home_area.trim() ? body.home_area.trim() : null;
	if (!name || name.length > 60) throw error(400, 'Channel name must be 1–60 characters');
	if (visibility !== 'open' && visibility !== 'private') throw error(400, 'visibility must be open or private');
	let sport: string | null = null;
	if (sportRaw !== null) {
		if (parseSports([sportRaw]).length === 0) throw error(400, 'unknown sport');
		sport = sportRaw;
	}
	const created = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`INSERT INTO channels (name, visibility, sport, home_area, created_by)
			 VALUES ($1, $2, $3, $4, current_user_id()) RETURNING id, name, visibility, sport, home_area, created_at`,
			[name, visibility, sport, homeArea]
		);
		const row = rows[0];
		await c.query(
			`INSERT INTO channel_members (channel_id, user_id, role, status)
			 VALUES ($1, current_user_id(), 'owner', 'active') ON CONFLICT DO NOTHING`,
			[row.id]
		);
		return {
			id: row.id as string,
			name: row.name as string,
			visibility: row.visibility as 'open' | 'private',
			sport: (row.sport as string | null) ?? null,
			home_area: (row.home_area as string | null) ?? null,
			created_at: (row.created_at as Date).toISOString(),
			is_member: true,
			member_count: 1
		};
	});
	return json({ ok: true, channel: created }, { headers: { 'Cache-Control': 'no-store' } });
};
