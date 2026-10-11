// /api/channels/[id] — single-crew detail, edit and delete.
//
// GET returns the crew row ({ id, name, visibility, sport, home_area, about,
// avatar_key, avatar_url, created_at, is_member, is_admin, member_count }).
// Open crews: any signed-in user. Private crews: active members only
// (403 'Members only', mirroring the roster endpoint). avatar_url is a
// presigned GET minted ONLY for rows this caller can see (same rule as the
// post-media URLs in Task 3) — null when no avatar is set.
//
// PATCH { name?, about?, avatar_key? } — crew admins only (403
// 'Crew admins only', mirroring the members endpoint). Caps: name 1–60
// (same copy as create), about ≤500 (empty clears to NULL). avatar_key is
// validated exactly like a post photo (owned key, server-mapped type,
// HEAD-verified image ≤10MB); failures after ownership passed delete the
// stray best-effort under the same contract as post-create. Replacing or
// clearing the avatar deletes the old object best-effort so crew avatars
// never strand billable objects. Returns { ok, channel } in the GET shape.
//
// DELETE — crew admins only. The row delete cascades via FK (members,
// events + RSVPs, crew posts + their media/comments/kudos rows); the avatar
// object (if any) is deleted best-effort via deleteObjects.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import {
	assertOwnedKey,
	assertValidKey,
	contentTypeForExt,
	setContentType,
	headObject,
	deleteObjects,
	presignGet
} from '$lib/server/media.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

interface ChannelRow {
	id: string;
	name: string;
	visibility: 'open' | 'private';
	sport: string | null;
	home_area: string | null;
	about: string | null;
	avatar_key: string | null;
	created_at: Date;
	is_member: boolean;
	is_admin: boolean;
	member_count: number;
}

// Best-effort stray cleanup (fire-and-forget): mirrors the post-create
// contract — a failed avatar attach must not strand the uploaded object.
const cleanupOwned = (ownedKeys: string[]): void => {
	if (ownedKeys.length > 0) {
		deleteObjects(ownedKeys).catch(() => {
			/* best-effort — the 400 below is the contract */
		});
	}
};

const extOf = (key: string): string => {
	const base = key.split('/').pop() ?? key;
	const dot = base.lastIndexOf('.');
	return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
};

// Owned-key + type + existence gate for a crew avatar, mirroring the
// post-create media checks (photo caps). Throws honest 400s; cleans up
// the caller's own stray on any failure after ownership passed.
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
		cleanupOwned(owned);
		throw error(400, 'Avatar must be a photo — re-upload and try again');
	}
	try {
		await setContentType(key, contentType);
	} catch {
		cleanupOwned(owned);
		throw error(400, 'Media upload not found — re-upload and try again');
	}
	let head: { bytes: number; contentType: string } | null;
	try {
		head = await headObject(key);
	} catch {
		cleanupOwned(owned);
		throw error(400, 'Could not verify media — re-upload and try again');
	}
	if (!head) {
		cleanupOwned(owned);
		throw error(400, 'Media upload not found — re-upload and try again');
	}
	if (!head.contentType.toLowerCase().startsWith('image/')) {
		cleanupOwned(owned);
		throw error(400, 'Avatar must be a photo — re-upload and try again');
	}
	if (head.bytes <= 0) {
		cleanupOwned(owned);
		throw error(400, 'Media upload is empty — re-upload and try again');
	}
	if (head.bytes > AVATAR_MAX_BYTES) {
		cleanupOwned(owned);
		throw error(400, 'Avatar exceeds the size limit');
	}
};

const toChannel = async (r: ChannelRow): Promise<Record<string, unknown>> => ({
	id: r.id,
	name: r.name,
	visibility: r.visibility,
	sport: r.sport,
	home_area: r.home_area,
	about: r.about,
	avatar_key: r.avatar_key,
	avatar_url: r.avatar_key ? await presignGet(r.avatar_key) : null,
	created_at: r.created_at.toISOString(),
	is_member: r.is_member,
	is_admin: r.is_admin,
	member_count: r.member_count
});

const SELECT_DETAIL = `SELECT ch.id, ch.name, ch.visibility, ch.sport, ch.home_area, ch.about, ch.avatar_key, ch.created_at,
	EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active') AS is_member,
	EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = ch.id AND m.user_id = current_user_id() AND m.status = 'active' AND m.role = 'admin') AS is_admin,
	(SELECT COUNT(*)::int FROM channel_members m WHERE m.channel_id = ch.id AND m.status = 'active') AS member_count
 FROM channels ch WHERE ch.id = $1`;

const mapRow = (r: Record<string, unknown>): ChannelRow => ({
	id: r.id as string,
	name: r.name as string,
	visibility: r.visibility as 'open' | 'private',
	sport: (r.sport as string | null) ?? null,
	home_area: (r.home_area as string | null) ?? null,
	about: (r.about as string | null) ?? null,
	avatar_key: (r.avatar_key as string | null) ?? null,
	created_at: r.created_at as Date,
	is_member: Boolean(r.is_member),
	is_admin: Boolean(r.is_admin),
	member_count: Number(r.member_count) || 0
});

export const GET: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const data = await withUser(me.id, async (c) => {
		const { rows } = await c.query(SELECT_DETAIL, [id]);
		if (rows.length === 0) throw error(404, 'Channel not found');
		const row = mapRow(rows[0] as Record<string, unknown>);
		if (row.visibility !== 'open' && !row.is_member) throw error(403, 'Members only');
		return { channel: await toChannel(row) };
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const PATCH: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	const body = await event.request.json().catch(() => null);
	const hasName = body?.name !== undefined;
	const hasAbout = body?.about !== undefined;
	const hasAvatar = body?.avatar_key !== undefined;
	if (!hasName && !hasAbout && !hasAvatar) {
		throw error(400, 'Nothing to update — send name, about or avatar_key');
	}
	let name: string | undefined;
	if (hasName) {
		name = typeof body?.name === 'string' ? body.name.trim() : '';
		if (!name || name.length > 60) throw error(400, 'Channel name must be 1–60 characters');
	}
	let about: string | null | undefined;
	if (hasAbout) {
		if (typeof body?.about !== 'string' && body?.about !== null) {
			throw error(400, 'About must be a string');
		}
		const trimmed = typeof body.about === 'string' ? body.about.trim() : '';
		if (trimmed.length > 500) throw error(400, 'About must be 500 characters or fewer');
		about = trimmed ? trimmed : null;
	}
	let avatarKey: string | null | undefined;
	if (hasAvatar) {
		if (typeof body?.avatar_key === 'string' && body.avatar_key) {
			await verifyAvatar(me.id, body.avatar_key);
			avatarKey = body.avatar_key as string;
		} else if (body?.avatar_key === null || body?.avatar_key === '') {
			avatarKey = null;
		} else {
			throw error(400, 'avatar_key must be a string or null');
		}
	}
	const data = await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, avatar_key FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const caller = await c.query(
			`SELECT role FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (caller.rows.length === 0 || caller.rows[0].role !== 'admin') {
			if (avatarKey !== undefined && avatarKey !== null) cleanupOwned([avatarKey]);
			throw error(403, 'Crew admins only');
		}
		const sets: string[] = [];
		const vals: unknown[] = [];
		if (name !== undefined) {
			vals.push(name);
			sets.push(`name = $${vals.length}`);
		}
		if (about !== undefined) {
			vals.push(about);
			sets.push(`about = $${vals.length}`);
		}
		if (avatarKey !== undefined) {
			vals.push(avatarKey);
			sets.push(`avatar_key = $${vals.length}`);
		}
		vals.push(id);
		await c.query(`UPDATE channels SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
		// Replacing or clearing the avatar orphans the old object — remove it
		// best-effort (the 200 below is the contract, not the cleanup).
		const oldKey = found.rows[0].avatar_key as string | null;
		if (avatarKey !== undefined && oldKey && oldKey !== avatarKey) {
			deleteObjects([oldKey]).catch(() => {
				/* best-effort */
			});
		}
		const { rows } = await c.query(SELECT_DETAIL, [id]);
		return { ok: true, channel: await toChannel(mapRow(rows[0] as Record<string, unknown>)) };
	});
	return json(data, { headers: { 'Cache-Control': 'no-store' } });
};

export const DELETE: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid channel id');
	await withUser(me.id, async (c) => {
		const found = await c.query('SELECT id, avatar_key FROM channels WHERE id = $1', [id]);
		if (found.rows.length === 0) throw error(404, 'Channel not found');
		const caller = await c.query(
			`SELECT role FROM channel_members
			 WHERE channel_id = $1 AND user_id = current_user_id() AND status = 'active'`,
			[id]
		);
		if (caller.rows.length === 0 || caller.rows[0].role !== 'admin') {
			throw error(403, 'Crew admins only');
		}
		// Members, events (+ RSVPs) and crew posts (+ their media/comments/
		// kudos rows) cascade via FK; the avatar object needs an explicit
		// delete (best-effort — the 200 below is the contract).
		const avatarKey = found.rows[0].avatar_key as string | null;
		await c.query('DELETE FROM channels WHERE id = $1', [id]);
		if (avatarKey) {
			deleteObjects([avatarKey]).catch(() => {
				/* best-effort */
			});
		}
	});
	return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
