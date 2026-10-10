// POST /api/media/upload-urls { files: [{ kind: 'photo'|'video', contentType, bytes }] }
// → { urls: [{ key, url }] }. Authed; validates kind/size caps BEFORE minting;
// ≤100 mints/day per user via the media_mints table (one row per minted file,
// so abandoned mints count too). 429 on cap breach (comments tone), 400 on
// unknown kind/oversize.
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
		// Mint rate limit, exact: every minted file leaves one media_mints
		// row (abandoned mints count, unlike the old post_media count).
		// Self-pruning — rows older than a day are deleted on every mint
		// call, so no sweeper process is needed for this table.
		await c.query(`DELETE FROM media_mints WHERE created_at < now() - interval '1 day'`);
		const { rows } = await c.query(
			`SELECT COUNT(*)::int AS n FROM media_mints
			 WHERE user_id = current_user_id() AND created_at > now() - interval '1 day'`
		);
		if (Number(rows[0]?.n) + parsed.length > MINTS_PER_DAY) {
			throw error(429, 'Slow down — daily upload limit reached');
		}
		for (let i = 0; i < parsed.length; i++) {
			await c.query(`INSERT INTO media_mints (user_id) VALUES (current_user_id())`);
		}
		return await Promise.all(
			parsed.map((f) => presignPut(mediaKey(me.id, f.ext), f.contentType, f.bytes))
		);
	});
	return json({ urls }, { headers: { 'Cache-Control': 'no-store' } });
};
