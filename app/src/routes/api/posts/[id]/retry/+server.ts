// POST /api/posts/[id]/retry — author-only requeue of a failed video job.
// Refuses with 422 + honest copy when there is nothing fixable to retry:
// no video job, already done, still running, the duration gate (a >60s video
// is unfixable by definition — rule 2, refused immediately regardless of
// attempts), or 3 attempts already burned.
import { json, error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireAuth } from '$lib/server/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Must stay byte-identical to the worker's duration-gate last_error
// (DURATION_GATE_ERROR in src/worker/transcode.ts) — a vitest asserts the
// equality (see src/worker/duration-gate.test.ts). Underscore prefix because
// SvelteKit rejects non-handler exports from +server.ts at build time.
export const _DURATION_GATE_ERROR = 'Video exceeds 60 seconds';
const MAX_ATTEMPTS = 3;

// Same posts_read rule as the GET ([id]/+server.ts): invisibility reads as
// missing (404); only a visible foreign post reaches the author-only 403.
const VISIBLE = `(p.visibility = 'public' OR p.author = current_user_id() OR (p.visibility = 'friends' AND is_friend(p.author))) AND (p.status = 'live' OR p.author = current_user_id())`;

export const POST: RequestHandler = async (event) => {
	const me = await requireAuth(event);
	const id = event.params.id ?? '';
	if (!UUID_RE.test(id)) throw error(400, 'Invalid post id');
	const data = await withUser(me.id, async (c) => {
		// Visibility first: strangers probing an invisible friends-post id
		// get 404, not 403 (no existence oracle). Author-only semantics
		// stay: non-author on a VISIBLE post still gets 403 below.
		const { rows: vis } = await c.query(
			`SELECT p.id, p.author FROM posts p WHERE p.id = $1 AND ${VISIBLE}`,
			[id]
		);
		if (vis.length === 0) throw error(404, 'Post not found');
		if ((vis[0].author as string) !== me.id) throw error(403, 'Only the author can retry a video');
		const { rows } = await c.query(
			`SELECT j.id AS job_id, j.status, j.attempts, j.last_error
			 FROM transcode_jobs j WHERE j.post_id = $1
			 ORDER BY j.created_at DESC NULLS LAST LIMIT 1`,
			[id]
		);
		if (rows.length === 0) throw error(422, 'Nothing to retry — this post has no video to process');
		const row = rows[0];
		const status = row.status as string;
		const attempts = Number(row.attempts) || 0;
		const lastError = (row.last_error as string | null) ?? null;
		if (status === 'done') throw error(422, 'Video already processed — nothing to retry');
		if (status === 'queued' || status === 'processing') {
			throw error(422, 'Video is still being processed — please wait');
		}
		if (lastError === _DURATION_GATE_ERROR) {
			throw error(
				422,
				'This video is over 60 seconds and cannot be processed — post a shorter clip instead'
			);
		}
		if (attempts >= MAX_ATTEMPTS) {
			throw error(
				422,
				'This video failed 3 times and cannot be retried — delete the post and try a different file'
			);
		}
		await c.query(
			`UPDATE transcode_jobs SET status = 'queued', last_error = NULL, updated_at = now() WHERE id = $1`,
			[row.job_id]
		);
		await c.query(`UPDATE posts SET status = 'processing', updated_at = now() WHERE id = $1`, [id]);
		return { job_id: row.job_id as string, attempts };
	});
	return json({ ok: true, id, ...data }, { headers: { 'Cache-Control': 'no-store' } });
};
