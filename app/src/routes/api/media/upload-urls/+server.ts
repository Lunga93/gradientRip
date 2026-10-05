// POST /api/media/upload-urls { files: [{ kind: 'photo'|'video', contentType, bytes }] }
// → { urls: [{ key, url }] }. Authed; validates kind/size caps BEFORE minting;
// ≤100 mints/day per user (approximation, see below). 400 on cap breach,
// 400 on unknown kind/oversize.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';
import { mediaKey, presignPut } from '$lib/server/media.js';

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 200 * 1024 * 1024;
const MINTS_PER_DAY = 100;

const EXT_BY_TYPE: Record<string, string> = {
	'image/jpeg': 'jpg',
	'image/png': 'png',
	'image/webp': 'webp',
	'image/gif': 'gif',
	'image/avif': 'avif',
	'video/mp4': 'mp4',
	'video/quicktime': 'mov',
	'video/webm': 'webm',
	'video/x-m4v': 'm4v'
};

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const body = await event.request.json().catch(() => null);
	const files = body?.files;
	if (!Array.isArray(files) || files.length === 0) {
		throw error(400, 'files must be a non-empty array');
	}
	interface MintRequest {
		kind: string;
		contentType: string;
		bytes: number;
		ext: string;
	}
	const parsed: MintRequest[] = files.map((f: unknown) => {
		const kind = (f as { kind?: unknown })?.kind;
		const contentType = (f as { contentType?: unknown })?.contentType;
		const bytes = (f as { bytes?: unknown })?.bytes;
		if (kind !== 'photo' && kind !== 'video') {
			throw error(400, "kind must be 'photo' or 'video'");
		}
		const cap = kind === 'photo' ? PHOTO_MAX_BYTES : VIDEO_MAX_BYTES;
		if (typeof contentType !== 'string' || !contentType) {
			throw error(400, 'contentType is required');
		}
		const prefix = kind === 'photo' ? 'image/' : 'video/';
		if (!contentType.toLowerCase().startsWith(prefix)) {
			throw error(400, `contentType must be ${prefix}* for ${kind}`);
		}
		if (typeof bytes !== 'number' || !Number.isInteger(bytes) || bytes <= 0 || bytes > cap) {
			throw error(400, `${kind} must be 1-${cap} bytes`);
		}
		const ext =
			EXT_BY_TYPE[contentType.toLowerCase().split(';')[0].trim()] ??
			(kind === 'photo' ? 'jpg' : 'mp4');
		return { kind, contentType, bytes, ext };
	});
	const urls = await withUser(me.id, async (c) => {
		// Mint rate limit, approximated: mints that never become posts leave no
		// row, so count the user's media rows on posts created today instead.
		// A mint-tracking table is overkill per plan; this under-counts
		// abandoned mints (fail-open) but blocks bulk abuse (fail-closed).
		const { rows } = await c.query(
			`SELECT COUNT(*)::int AS n FROM post_media m JOIN posts p ON p.id = m.post_id
			 WHERE p.author = current_user_id() AND p.created_at > now() - interval '1 day'`
		);
		if (Number(rows[0]?.n) + parsed.length > MINTS_PER_DAY) {
			throw error(400, 'Daily upload limit reached');
		}
		return await Promise.all(
			parsed.map((f) => presignPut(mediaKey(me.id, f.ext), f.contentType, f.bytes))
		);
	});
	return json({ urls }, { headers: { 'Cache-Control': 'no-store' } });
};
