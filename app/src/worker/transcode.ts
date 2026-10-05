/* eslint-disable no-console */
// Transcode worker — standalone plain-Node process run via `npm run worker`
// (tsx), NOT SvelteKit. That is why DB/S3 env come from raw `process.env`
// (tsx does not load app/.env either — pass them explicitly, e.g.
// `DATABASE_URL=… S3_ENDPOINT=… S3_ACCESS_KEY=… S3_SECRET_KEY=… S3_BUCKET=… npm
// run worker`, same as scripts/migrate.ts) and why `$env/dynamic/private`
// (imported by the media module) resolves via tsconfig.worker.json to the
// sibling env-shim. S3 access itself is NOT reimplemented: the client, key
// factory and content-type map come from `../lib/server/media.js`.
//
// Loop: poll one `queued` job (SKIP LOCKED, oldest first) → `processing` →
// ffprobe duration gate (>60s → terminal `failed`, no transcode) → ffmpeg
// 720p + 480p + poster → S3 PUTs → media rows + post `live` + job `done`.
// Any failure burns one attempt: back to `queued` below 3 attempts, else
// terminal `failed` + post `failed`. SIGTERM/SIGINT finishes the current job
// then exits (no new poll).
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { Pool } from 'pg';
import { contentTypeForExt, mediaKey, s3 } from '../lib/server/media.js';

const execFileAsync = promisify(execFile);

const MAX_ATTEMPTS = 3;
const MAX_DURATION_S = 60;
const IDLE_SLEEP_MS = 5000;
const LAST_ERROR_MAX = 500;

// Same expression as the media module's private BUCKET (env, else default);
// the module does not export it, so it is mirrored here, not reimplemented.
const BUCKET = process.env.S3_BUCKET || 'gradientrip-media';

const POLL_SQL = `SELECT id FROM transcode_jobs WHERE status='queued' AND EXISTS (SELECT 1 FROM posts p WHERE p.id = post_id) ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;

interface JobDetail {
	id: string;
	post_id: string;
	media_id: string;
	attempts: number;
	src_key: string;
	author: string;
}

const log = (jobId: string | null, stage: string, detail: string): void => {
	console.log(`[job ${jobId ?? '-'}] stage=${stage} ${detail}`.trimEnd());
};

const truncate = (s: string, max: number = LAST_ERROR_MAX): string => {
	const t = s.trimEnd();
	return t.length > max ? `${t.slice(0, max)}…` : t;
};

const errDetail = (e: unknown): string => {
	if (e && typeof e === 'object') {
		const rec = e as Record<string, unknown>;
		const stderr = typeof rec.stderr === 'string' ? rec.stderr.trim() : '';
		const stdout = typeof rec.stdout === 'string' ? rec.stdout.trim() : '';
		const message = e instanceof Error ? e.message : String(e);
		// execFile failures already embed stderr in message — don't repeat it.
		if (stderr && message.includes(stderr)) return truncate(message);
		if (stdout && message.includes(stdout)) return truncate(message);
		return truncate([message, stderr, stdout].filter(Boolean).join(' | '));
	}
	return truncate(String(e));
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// Poster rule: keep the verbatim 1s seek for normal videos; sub-1s clips use their midpoint (always exists).
export function posterSeekSeconds(duration: number): number {
	return Math.min(1, duration / 2);
}

async function pollOnce(pool: Pool): Promise<string | null> {
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		const { rows } = await client.query(POLL_SQL);
		const id: string | undefined = rows[0]?.id;
		if (!id) {
			await client.query('ROLLBACK');
			return null;
		}
		await client.query(`UPDATE transcode_jobs SET status='processing', updated_at=now() WHERE id=$1`, [
			id
		]);
		await client.query('COMMIT');
		return id;
	} catch (e) {
		await client.query('ROLLBACK').catch(() => {});
		throw e;
	} finally {
		client.release();
	}
}

async function loadJob(pool: Pool, jobId: string): Promise<JobDetail | null> {
	const { rows } = await pool.query(
		`SELECT j.id, j.post_id, j.media_id, j.attempts, m.s3_key AS src_key, p.author
		 FROM transcode_jobs j
		 JOIN post_media m ON m.id = j.media_id
		 JOIN posts p ON p.id = j.post_id
		 WHERE j.id = $1`,
		[jobId]
	);
	if (!rows[0]) return null;
	const r = rows[0] as {
		id: string;
		post_id: string;
		media_id: string;
		attempts: number;
		src_key: string;
		author: string;
	};
	return {
		id: r.id,
		post_id: r.post_id,
		media_id: r.media_id,
		attempts: Number(r.attempts),
		src_key: r.src_key,
		author: r.author
	};
}

async function downloadSource(srcKey: string, destPath: string): Promise<number> {
	const out = await s3().send(new GetObjectCommand({ Bucket: BUCKET, Key: srcKey }));
	if (!out.Body || typeof (out.Body as { transformToByteArray?: unknown }).transformToByteArray !== 'function')
		throw new Error(`S3 object missing or unreadable: ${srcKey}`);
	const bytes = await (
		out.Body as { transformToByteArray: () => Promise<Uint8Array> }
	).transformToByteArray();
	await fs.writeFile(destPath, bytes);
	return bytes.length;
}

async function probeDuration(path: string): Promise<number> {
	let stdout: string;
	try {
		const res = await execFileAsync('ffprobe', [
			'-v',
			'error',
			'-show_entries',
			'format=duration',
			'-of',
			'csv=p=0',
			path
		]);
		stdout = res.stdout.trim();
	} catch (e) {
		throw new Error(`probe failed: ${errDetail(e)}`, { cause: e });
	}
	const duration = Number.parseFloat(stdout);
	if (!Number.isFinite(duration))
		throw new Error(`probe failed: non-numeric duration ${JSON.stringify(stdout.slice(0, 100))}`);
	return duration;
}

async function probeDims(path: string): Promise<{ width: number; height: number } | null> {
	try {
		const { stdout } = await execFileAsync('ffprobe', [
			'-v',
			'error',
			'-select_streams',
			'v:0',
			'-show_entries',
			'stream=width,height',
			'-of',
			'csv=p=0',
			path
		]);
		const [w, h] = stdout.trim().split(',').map(Number);
		if (!Number.isInteger(w) || !Number.isInteger(h) || w <= 0 || h <= 0) return null;
		return { width: w, height: h };
	} catch {
		return null;
	}
}

async function putFile(key: string, path: string, contentType: string): Promise<number> {
	const { size } = await fs.stat(path);
	await s3().send(
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key,
			Body: createReadStream(path),
			ContentType: contentType,
			ContentLength: size
		})
	);
	return size;
}

async function recordFailure(pool: Pool, job: JobDetail, message: string): Promise<void> {
	const attempts = job.attempts + 1;
	const lastError = truncate(message);
	if (attempts >= MAX_ATTEMPTS) {
		await pool.query(
			`UPDATE transcode_jobs SET status='failed', attempts=$2, last_error=$3, updated_at=now() WHERE id=$1`,
			[job.id, attempts, lastError]
		);
		await pool.query(`UPDATE posts SET status='failed', updated_at=now() WHERE id=$1`, [job.post_id]);
		log(job.id, 'failed', `attempt=${attempts} terminal=true error="${lastError}"`);
	} else {
		await pool.query(
			`UPDATE transcode_jobs SET status='queued', attempts=$2, last_error=$3, updated_at=now() WHERE id=$1`,
			[job.id, attempts, lastError]
		);
		log(job.id, 'failed', `attempt=${attempts} terminal=false error="${lastError}"`);
	}
}

async function recordDurationGate(pool: Pool, job: JobDetail, duration: number): Promise<void> {
	const lastError = 'Video exceeds 60 seconds';
	await pool.query(
		`UPDATE transcode_jobs SET status='failed', attempts=$2, last_error=$3, updated_at=now() WHERE id=$1`,
		[job.id, job.attempts + 1, lastError]
	);
	await pool.query(`UPDATE posts SET status='failed', updated_at=now() WHERE id=$1`, [job.post_id]);
	log(job.id, 'failed', `reason=duration_gate duration_s=${duration.toFixed(2)} error="${lastError}"`);
}

export async function processJob(pool: Pool, jobId: string): Promise<void> {
	const job = await loadJob(pool, jobId);
	if (!job) {
		await pool.query(
			`UPDATE transcode_jobs SET status='failed', last_error='post or source vanished', updated_at=now() WHERE id=$1`,
			[jobId]
		);
		log(jobId, 'failed', 'post or source vanished');
		return;
	}
	const prefix = `transcode-${job.id}`;
	const tmpIn = join(tmpdir(), `${prefix}-in`);
	const tmp720 = join(tmpdir(), `${prefix}-720.mp4`);
	const tmp480 = join(tmpdir(), `${prefix}-480.mp4`);
	const tmpPoster = join(tmpdir(), `${prefix}-poster.jpg`);
	const tmpFiles = [tmpIn, tmp720, tmp480, tmpPoster];
	try {
		const srcBytes = await downloadSource(job.src_key, tmpIn);
		log(job.id, 'poll', `status=claimed post=${job.post_id} src_bytes=${srcBytes}`);

		const duration = await probeDuration(tmpIn);
		log(job.id, 'probe', `duration_s=${duration.toFixed(2)}`);
		if (duration > MAX_DURATION_S) {
			await recordDurationGate(pool, job, duration);
			return;
		}

		const t0 = Date.now();
		const ss = posterSeekSeconds(duration);
		try {
			await execFileAsync('ffmpeg', [
				'-y',
				'-i',
				tmpIn,
				'-map',
				'0:v:0',
				'-map',
				'0:a?',
				'-c:v',
				'libx264',
				'-preset',
				'veryfast',
				'-crf',
				'23',
				'-vf',
				'scale=-2:720',
				'-c:a',
				'aac',
				'-movflags',
				'+faststart',
				tmp720
			]);
			await execFileAsync('ffmpeg', [
				'-y',
				'-i',
				tmpIn,
				'-map',
				'0:v:0',
				'-map',
				'0:a?',
				'-c:v',
				'libx264',
				'-preset',
				'veryfast',
				'-crf',
				'25',
				'-vf',
				'scale=-2:480',
				'-c:a',
				'aac',
				'-movflags',
				'+faststart',
				tmp480
			]);
			await execFileAsync('ffmpeg', [
				'-y',
				'-ss',
				String(ss),
				'-i',
				tmpIn,
				'-vframes',
				'1',
				'-q:v',
				'4',
				tmpPoster
			]);
		} catch (e) {
			throw new Error(`transcode failed: ${errDetail(e)}`, { cause: e });
		}
		log(job.id, 'transcode', `elapsed_s=${((Date.now() - t0) / 1000).toFixed(1)}`);

		const key720 = mediaKey(job.author, 'mp4');
		const key480 = mediaKey(job.author, 'mp4');
		const keyPoster = mediaKey(job.author, 'jpg');
		const videoType = contentTypeForExt('mp4') ?? 'video/mp4';
		const posterType = contentTypeForExt('jpg') ?? 'image/jpeg';
		const bytes720 = await putFile(key720, tmp720, videoType);
		const bytes480 = await putFile(key480, tmp480, videoType);
		const bytesPoster = await putFile(keyPoster, tmpPoster, posterType);
		log(
			job.id,
			'upload',
			`rendition_720p_bytes=${bytes720} rendition_480p_bytes=${bytes480} poster_bytes=${bytesPoster}`
		);

		const [dims720, dims480] = await Promise.all([probeDims(tmp720), probeDims(tmp480)]);
		const client = await pool.connect();
		try {
			await client.query('BEGIN');
			const { rows } = await client.query(
				`SELECT COALESCE(MAX(sort), -1) AS max_sort FROM post_media WHERE post_id=$1`,
				[job.post_id]
			);
			const base = Number((rows[0] as { max_sort: number }).max_sort) + 1;
			await client.query(
				`INSERT INTO post_media (post_id, kind, s3_key, width, height, duration_s, bytes, sort)
				 VALUES ($1,'video',$2,$3,$4,$5,$6,$7), ($1,'video',$8,$9,$10,$5,$11,$12), ($1,'poster',$13,NULL,NULL,NULL,$14,$15)`,
				[
					job.post_id,
					key720,
					dims720?.width ?? null,
					dims720?.height ?? null,
					duration,
					bytes720,
					base,
					key480,
					dims480?.width ?? null,
					dims480?.height ?? null,
					bytes480,
					base + 1,
					keyPoster,
					bytesPoster,
					base + 2
				]
			);
			await client.query(`UPDATE posts SET status='live', updated_at=now() WHERE id=$1`, [
				job.post_id
			]);
			await client.query(
				`UPDATE transcode_jobs SET status='done', last_error=NULL, updated_at=now() WHERE id=$1`,
				[job.id]
			);
			await client.query('COMMIT');
		} catch (e) {
			await client.query('ROLLBACK').catch(() => {});
			throw e;
		} finally {
			client.release();
		}
		log(job.id, 'done', `post=${job.post_id} status=live renditions=2 poster=1`);
	} catch (e) {
		await recordFailure(pool, job, e instanceof Error ? e.message : String(e));
	} finally {
		await Promise.all(tmpFiles.map((f) => fs.rm(f, { force: true })));
	}
}

async function main(): Promise<void> {
	if (!process.env.DATABASE_URL) {
		console.error('DATABASE_URL is required');
		process.exit(1);
	}
	const pool = new Pool({ connectionString: process.env.DATABASE_URL });
	let shuttingDown = false;
	const onSignal = (sig: string): void => {
		if (!shuttingDown) console.log(`[worker] stage=shutdown msg="${sig} received, finishing current job"`);
		shuttingDown = true;
	};
	process.on('SIGTERM', () => onSignal('SIGTERM'));
	process.on('SIGINT', () => onSignal('SIGINT'));
	console.log(
		`[worker] stage=boot msg="transcode worker starting" bucket=${BUCKET} max_attempts=${MAX_ATTEMPTS} idle_sleep_ms=${IDLE_SLEEP_MS}`
	);
	try {
		for (;;) {
			if (shuttingDown) break;
			let jobId: string | null;
			try {
				jobId = await pollOnce(pool);
			} catch (e) {
				log(null, 'poll', `error="${errDetail(e)}"`);
				const deadline = Date.now() + IDLE_SLEEP_MS;
				while (!shuttingDown && Date.now() < deadline) await sleep(250);
				continue;
			}
			if (!jobId) {
				log(null, 'poll', 'result=idle');
				const deadline = Date.now() + IDLE_SLEEP_MS;
				while (!shuttingDown && Date.now() < deadline) await sleep(250);
				continue;
			}
			await processJob(pool, jobId);
		}
	} finally {
		await pool.end();
	}
	console.log('[worker] stage=shutdown msg="exiting, no new poll"');
}

// Guarded so unit tests can import the pure helper above without booting the
// poll loop (vitest sets VITEST / VITEST_WORKER_ID; the worker never does).
const isTestEnv = process.env.VITEST === 'true' || Boolean(process.env.VITEST_WORKER_ID);
if (!isTestEnv) {
	void main().catch((e: unknown) => {
		console.error(`[worker] stage=failed error="${e instanceof Error ? e.message : String(e)}"`);
		process.exit(1);
	});
}
