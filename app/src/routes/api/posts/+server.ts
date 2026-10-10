// POST /api/posts { body?, media: [{ key, kind }], ride?: { kind: 'trip'|'route', id }, visibility }
//
// Creates a text/photo/video/ride post. Server re-validates everything the
// Task 2 upload-urls endpoint pre-checked: every key must live under the
// caller's own namespace (assertOwnedKey), then gets its server-mapped
// Content-Type copied on (raw browser uploads carry no Content-Type —
// HEAD-verifying a raw upload directly would fail, so CopyObject first,
// HEAD-verify second) and is HEAD-checked for existence, type and size.
// Missing/mismatch/oversize → 400.
//
// Best-effort delete rule (documented, honest): on ANY 400 after ownership
// passed, ALL caller-owned keys in the request are deleted best-effort
// (errors ignored) so failed creates never strand billable objects. Foreign
// keys are never touched.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import {
	assertOwnedKey,
	contentTypeForExt,
	setContentType,
	headObject,
	deleteObjects,
	presignGet
} from '$lib/server/media.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const POSTS_PER_DAY = 30;

interface MediaInput {
	key: string;
	kind: 'photo' | 'video';
}

interface VerifiedMedia extends MediaInput {
	bytes: number;
}

// Best-effort stray cleanup (fire-and-forget): on ANY 400 after ownership
// passed, ALL caller-owned keys in the request are deleted best-effort so
// failed creates never strand billable objects. Foreign keys are never
// passed here, so they are never deleted.
const cleanupOwned = (ownedKeys: string[]): void => {
	if (ownedKeys.length > 0) {
		deleteObjects(ownedKeys).catch(() => {
			/* best-effort — the 400 below is the contract */
		});
	}
};

function fail(ownedKeys: string[], status: 400, message: string): never {
	cleanupOwned(ownedKeys);
	throw error(status, message);
}

const extOf = (key: string): string => {
	const base = key.split('/').pop() ?? key;
	const dot = base.lastIndexOf('.');
	return dot < 0 ? '' : base.slice(dot + 1).toLowerCase();
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);

	const visibility = typeof body?.visibility === 'string' ? body.visibility : '';
	if (visibility !== 'public' && visibility !== 'friends' && visibility !== 'crew') {
		throw error(400, "visibility must be 'public', 'friends' or 'crew'");
	}

	// Crew audience: crew_id required iff visibility is crew (the exactly-one
	// rule posts_crew_check enforces in the DB; validated here for honest
	// 400s instead of 500s). Membership itself is checked in SQL inside the
	// txn below (is_crew_member), not in app logic.
	let crewId: string | null = null;
	const rawCrewId: unknown = body?.crew_id ?? null;
	if (visibility === 'crew') {
		if (typeof rawCrewId !== 'string' || !UUID_RE.test(rawCrewId)) {
			throw error(400, 'crew_id is required when visibility is crew');
		}
		crewId = rawCrewId;
	} else if (rawCrewId !== null && rawCrewId !== undefined) {
		throw error(400, 'crew_id is only allowed when visibility is crew');
	}

	// Text: optional iff media or ride attached; when present, 1–500 chars.
	let text: string | null = null;
	if (body?.body !== undefined && body?.body !== null) {
		if (typeof body.body !== 'string') throw error(400, 'body must be a string');
		const trimmed = body.body.trim();
		if (trimmed.length < 1 || trimmed.length > 500) {
			throw error(400, 'body must be 1-500 chars');
		}
		text = trimmed;
	}

	// Media shape + count caps (≤4 photos, ≤1 video per Global Constraints).
	const rawMedia: unknown = body?.media ?? [];
	if (!Array.isArray(rawMedia)) throw error(400, 'media must be an array');
	const media: MediaInput[] = rawMedia.map((m: unknown) => {
		const key = (m as { key?: unknown })?.key;
		const kind = (m as { kind?: unknown })?.kind;
		if (typeof key !== 'string' || !key) throw error(400, 'media key is required');
		if (kind !== 'photo' && kind !== 'video') throw error(400, "media kind must be 'photo' or 'video'");
		return { key, kind };
	});
	const photos = media.filter((m) => m.kind === 'photo').length;
	const videos = media.filter((m) => m.kind === 'video').length;
	if (photos > 4) throw error(400, 'At most 4 photos per post');
	if (videos > 1) throw error(400, 'At most 1 video per post');

	// Ride shape (existence/ownership checked inside the txn below).
	const rawRide: unknown = body?.ride ?? null;
	let ride: { kind: 'trip' | 'route'; id: number | string } | null = null;
	if (rawRide !== null && rawRide !== undefined) {
		const kind = (rawRide as { kind?: unknown })?.kind;
		const id = (rawRide as { id?: unknown })?.id;
		if (kind !== 'trip' && kind !== 'route') throw error(400, "ride kind must be 'trip' or 'route'");
		if (kind === 'trip') {
			if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
				throw error(400, 'Invalid trip id');
			}
			ride = { kind, id };
		} else {
			if (typeof id !== 'string' || !UUID_RE.test(id)) throw error(400, 'Invalid route id');
			ride = { kind, id };
		}
	}

	if (text === null && media.length === 0 && ride === null) {
		throw error(400, 'Post needs text, media or an attached ride');
	}

	// Ownership gate (ruling 4): EVERY client-supplied key, before anything
	// else touches S3. Keys failing here are foreign — never deleted.
	const ownedKeys: string[] = [];
	for (const m of media) {
		try {
			assertOwnedKey(me.id, m.key);
		} catch {
			fail(
				ownedKeys,
				400,
				'Media key does not belong to you — upload under your own account'
			);
		}
		ownedKeys.push(m.key);
	}

	// Server-mapped Content-Type first (ruling 3), then HEAD-verify.
	const verified: VerifiedMedia[] = [];
	for (const m of media) {
		const contentType = contentTypeForExt(extOf(m.key));
		if (!contentType) fail(ownedKeys, 400, `Unsupported media type for ${m.kind}`);
		try {
			await setContentType(m.key, contentType as string);
		} catch {
			fail(ownedKeys, 400, 'Media upload not found — re-upload and try again');
		}
		let head: { bytes: number; contentType: string } | null = null;
		try {
			head = await headObject(m.key);
		} catch {
			fail(ownedKeys, 400, 'Could not verify media — re-upload and try again');
		}
		if (!head) fail(ownedKeys, 400, 'Media upload not found — re-upload and try again');
		const prefix = m.kind === 'photo' ? 'image/' : 'video/';
		if (!head.contentType.toLowerCase().startsWith(prefix)) {
			fail(ownedKeys, 400, `Media type mismatch for ${m.kind} — re-upload and try again`);
		}
		if (head.bytes <= 0) fail(ownedKeys, 400, 'Media upload is empty — re-upload and try again');
		const cap = m.kind === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
		if (head.bytes > cap) fail(ownedKeys, 400, `${m.kind} exceeds the size limit`);
		verified.push({ ...m, bytes: head.bytes });
	}

	const hasVideo = verified.some((m) => m.kind === 'video');
	const status = hasVideo ? 'processing' : 'live';

	const created = await withUser(me.id, async (c) => {
		// Daily post cap (Global Constraints, server-enforced).
		const { rows: counted } = await c.query(
			`SELECT COUNT(*)::int AS n FROM posts
			 WHERE author = current_user_id() AND created_at > now() - interval '1 day'`
		);
		if (Number(counted[0]?.n) >= POSTS_PER_DAY) {
			fail(ownedKeys, 400, 'Daily post limit reached — try again tomorrow');
		}
		// Crew audience gate: the caller must be an active member of the
		// target crew (evaluated in SQL via is_crew_member under the session
		// user — never app logic). Non-members get 403; stray objects are
		// cleaned up under the same contract as the 400 paths above.
		if (crewId !== null) {
			const { rows: membership } = await c.query('SELECT is_crew_member($1) AS ok', [crewId]);
			if (!membership[0]?.ok) {
				cleanupOwned(ownedKeys);
				throw error(403, 'You must be a member of this crew to post to it');
			}
		}
		// Ride eligibility: own trips only; routes must be visible.
		let rideKind: string | null = null;
		let rideTripId: number | null = null;
		let rideRouteId: string | null = null;
		if (ride !== null) {
			if (ride.kind === 'trip') {
				const found = await c.query(
					'SELECT id FROM trips WHERE id = $1 AND user_id = current_user_id()',
					[ride.id]
				);
				if (found.rows.length === 0) {
					// Same stray-cleanup contract as the 400 paths: the S3
					// objects were already CopyObject+HEAD verified above, so
					// a bogus ride id must not strand them.
					cleanupOwned(ownedKeys);
					throw error(404, 'Trip not found');
				}
				rideKind = 'trip';
				rideTripId = ride.id as number;
			} else {
				const found = await c.query(
					'SELECT id FROM public_routes WHERE id = $1 AND hidden = false',
					[ride.id]
				);
				if (found.rows.length === 0) {
					// Same stray-cleanup contract as the 400 paths (see above).
					cleanupOwned(ownedKeys);
					throw error(404, 'Route not found');
				}
				rideKind = 'route';
				rideRouteId = ride.id as string;
			}
		}
		const { rows: posts } = await c.query(
			`INSERT INTO posts (author, body, visibility, crew_id, ride_kind, ride_trip_id, ride_route_id, status)
			 VALUES (current_user_id(), $1, $2, $3, $4, $5, $6, $7)
			 RETURNING id, body, visibility, crew_id, ride_kind, ride_trip_id, ride_route_id, status, kudos, created_at`,
			[text, visibility, crewId, rideKind, rideTripId, rideRouteId, status]
		);
		const post = posts[0];
		const mediaRows: { id: string; kind: string; s3_key: string; bytes: number }[] = [];
		for (let i = 0; i < verified.length; i++) {
			const v = verified[i];
			const { rows } = await c.query(
				`INSERT INTO post_media (post_id, kind, s3_key, bytes, sort)
				 VALUES ($1, $2, $3, $4, $5)
				 RETURNING id, kind, s3_key, bytes`,
				[post.id, v.kind, v.key, v.bytes, i]
			);
			mediaRows.push({
				id: rows[0].id as string,
				kind: rows[0].kind as string,
				s3_key: rows[0].s3_key as string,
				bytes: rows[0].bytes as number
			});
		}
		// Video → exactly one queued transcode job (migration-owned columns
		// only: post_id, media_id, status; attempts default, last_error null).
		const videoRow = mediaRows.find((r) => r.kind === 'video');
		if (videoRow) {
			await c.query(`INSERT INTO transcode_jobs (post_id, media_id, status) VALUES ($1, $2, 'queued')`, [
				post.id,
				videoRow.id
			]);
		}
		return { post, mediaRows };
	});

	const mediaOut = await Promise.all(
		created.mediaRows.map(async (r) => ({
			id: r.id,
			kind: r.kind,
			bytes: r.bytes,
			url: await presignGet(r.s3_key)
		}))
	);
	return json(
		{
			id: created.post.id as string,
			body: (created.post.body as string | null) ?? null,
			visibility: created.post.visibility as string,
			crew_id: (created.post.crew_id as string | null) ?? null,
			status: created.post.status as string,
			ride:
				created.post.ride_kind === 'trip'
					? { kind: 'trip' as const, id: Number(created.post.ride_trip_id) }
					: created.post.ride_kind === 'route'
						? { kind: 'route' as const, id: created.post.ride_route_id as string }
						: null,
			kudos: Number(created.post.kudos) || 0,
			created_at: (created.post.created_at as Date).toISOString(),
			media: mediaOut
		},
		{ headers: { 'Cache-Control': 'no-store' } }
	);
};
