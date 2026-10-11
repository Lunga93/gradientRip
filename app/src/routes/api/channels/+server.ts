// /api/channels — GET lists channels readable by the caller (open + member
// private). POST { name, visibility, sport?, home_area?, about?, avatar_key? }
// creates one and auto-joins the creator as admin. about caps at 500 chars
// (empty clears to NULL); avatar_key is validated exactly like a post photo
// (owned key, server-mapped type, HEAD-verified image ≤10MB) with the same
// best-effort stray cleanup on failure.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { parseSports } from '$lib/profiles/profile.js';
import {
	assertOwnedKey,
	assertValidKey,
	contentTypeForExt,
	setContentType,
	headObject,
	deleteObjects
} from '$lib/server/media.js';

const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

const extOf = (key: string): string => {
	const base = key.split('/').pop() ?? key;
	const dot = base.lastIndexOf('.');
	return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
};

// Same avatar gate as PATCH /api/channels/[id] (duplicated — route modules
// here duplicate their small validators rather than importing each other).
const verifyAvatar = async (meId: string, key: string): Promise<void> => {
	try {
		assertValidKey(key);
	} catch {
		throw error(400, 'Invalid avatar key — re-upload and try again');
	}
	try {
		assertOwnedKey(meId, key);
	} catch {
		throw error(400, 'Media key does not belong to you — upload under your own account');
	}
	const owned = [key];
	const contentType = contentTypeForExt(extOf(key));
	if (!contentType || !contentType.toLowerCase().startsWith('image/')) {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Avatar must be a photo — re-upload and try again');
	}
	try {
		await setContentType(key, contentType);
	} catch {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Media upload not found — re-upload and try again');
	}
	let head: { bytes: number; contentType: string } | null;
	try {
		head = await headObject(key);
	} catch {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Could not verify media — re-upload and try again');
	}
	if (!head) {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Media upload not found — re-upload and try again');
	}
	if (!head.contentType.toLowerCase().startsWith('image/')) {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Avatar must be a photo — re-upload and try again');
	}
	if (head.bytes <= 0) {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Media upload is empty — re-upload and try again');
	}
	if (head.bytes > AVATAR_MAX_BYTES) {
		deleteObjects(owned).catch(() => {});
		throw error(400, 'Avatar exceeds the size limit');
	}
};

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`SELECT ch.id, ch.name, ch.visibility, ch.sport, ch.home_area, ch.about, ch.avatar_key, ch.created_at,
				EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active') AS is_member,
				EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active' AND m.role = 'admin') AS is_admin,
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
				about: (r.about as string | null) ?? null,
				avatar_key: (r.avatar_key as string | null) ?? null,
				created_at: (r.created_at as Date).toISOString(),
				is_member: Boolean(r.is_member),
				is_admin: Boolean(r.is_admin),
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
	const aboutRaw = typeof body?.about === 'string' ? body.about.trim() : '';
	const avatarInput: unknown = body?.avatar_key;
	if (!name || name.length > 60) throw error(400, 'Channel name must be 1–60 characters');
	if (visibility !== 'open' && visibility !== 'private') throw error(400, 'visibility must be open or private');
	if (aboutRaw.length > 500) throw error(400, 'About must be 500 characters or fewer');
	const about = aboutRaw ? aboutRaw : null;
	let avatarKey: string | null = null;
	if (typeof avatarInput === 'string' && avatarInput) {
		await verifyAvatar(me.id, avatarInput);
		avatarKey = avatarInput;
	} else if (avatarInput !== undefined && avatarInput !== null && avatarInput !== '') {
		throw error(400, 'avatar_key must be a string or null');
	}
	let sport: string | null = null;
	if (sportRaw !== null) {
		if (parseSports([sportRaw]).length === 0) throw error(400, 'unknown sport');
		sport = sportRaw;
	}
	const created = await withUser(me.id, async (c) => {
		const { rows } = await c.query(
			`INSERT INTO channels (name, visibility, sport, home_area, about, avatar_key, created_by)
			 VALUES ($1, $2, $3, $4, $5, $6, current_user_id()) RETURNING id, name, visibility, sport, home_area, about, avatar_key, created_at`,
			[name, visibility, sport, homeArea, about, avatarKey]
		);
		const row = rows[0];
		await c.query(
			`INSERT INTO channel_members (channel_id, user_id, role, status)
			 VALUES ($1, current_user_id(), 'admin', 'active') ON CONFLICT DO NOTHING`,
			[row.id]
		);
		return {
			id: row.id as string,
			name: row.name as string,
			visibility: row.visibility as 'open' | 'private',
			sport: (row.sport as string | null) ?? null,
			home_area: (row.home_area as string | null) ?? null,
			about: (row.about as string | null) ?? null,
			avatar_key: (row.avatar_key as string | null) ?? null,
			created_at: (row.created_at as Date).toISOString(),
			is_member: true,
			is_admin: true,
			member_count: 1
		};
	});
	return json({ ok: true, channel: created }, { headers: { 'Cache-Control': 'no-store' } });
};
