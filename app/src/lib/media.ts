// Composer media helpers (client-side).
//
// - fitWithin(): pure dimension math for photo downscaling (unit-tested).
// - compressPhoto(): canvas downscale, long edge ≤1600px, JPEG ~0.82.
//   createImageBitmap applies EXIF orientation (imageOrientation:
//   'from-image'), so phone photos never arrive sideways.
// - probeVideoDuration(): client-side duration probe — videos over
//   VIDEO_MAX_SECONDS (60s) are rejected BEFORE upload. The server/worker
//   enforce the cap again independently; this is the early honest gate.
// - putObjectBytes(): raw header-less PUT to a presigned URL. The body MUST
//   stay a Uint8Array/ArrayBuffer with NO Content-Type header: the dummy
//   S3 (s3rver) answers preflight without Allow-Headers, so any explicit
//   Content-Type (e.g. from passing a Blob/File, or setting the header
//   manually) fails CORS. The server stamps the validated type on via
//   CopyObject after upload, then HEAD-verifies.

export const PHOTO_MAX_EDGE = 1600;
export const PHOTO_JPEG_QUALITY = 0.82;
export const VIDEO_MAX_SECONDS = 60;
export const MAX_PHOTOS = 4;
export const MAX_VIDEOS = 1;
export const POST_TEXT_MAX = 500;

/** Scale (w, h) so the long edge is ≤ max, preserving ratio. No upscaling. */
export function fitWithin(w: number, h: number, max: number): [number, number] {
	if (!Number.isFinite(w) || !Number.isFinite(h) || !Number.isFinite(max) || w <= 0 || h <= 0) {
		throw new Error('fitWithin needs positive finite dimensions');
	}
	if (w <= max && h <= max) return [w, h];
	const scale = max / Math.max(w, h);
	return [Math.round(w * scale), Math.round(h * scale)];
}

/** Downscale a photo to JPEG (long edge ≤1600px). Falls back to the
 *  original bytes when canvas encode is unavailable. */
export async function compressPhoto(file: Blob): Promise<Blob> {
	const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
	try {
		const [w, h] = fitWithin(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
		const canvas = document.createElement('canvas');
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext('2d');
		if (!ctx) return file;
		ctx.drawImage(bitmap, 0, 0, w, h);
		const out = await new Promise<Blob | null>((resolve) =>
			canvas.toBlob((b) => resolve(b), 'image/jpeg', PHOTO_JPEG_QUALITY)
		);
		return out ?? file;
	} finally {
		bitmap.close();
	}
}

/** Resolve a video file's duration in seconds (client-side probe). Rejects
 *  when the file cannot be decoded as video.
 *
 *  Duration can lag metadata: Chromium may fire `loadedmetadata` with a
 *  non-finite duration (e.g. moov box at the end of the file) and report
 *  the real length later via `durationchange` — so both events feed the
 *  same settle-once gate. A 15s backstop rejects instead of spinning
 *  forever when no duration ever arrives. */
export function probeVideoDuration(file: Blob): Promise<number> {
	const PROBE_TIMEOUT_MS = 15000;
	return new Promise((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement('video');
		video.preload = 'metadata';
		video.muted = true;
		let settled = false;
		const timer = setTimeout(() => {
			done(() => reject(new Error('Could not read this video file')));
		}, PROBE_TIMEOUT_MS);
		const done = (fn: () => void): void => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			URL.revokeObjectURL(url);
			video.removeAttribute('src');
			video.load();
			fn();
		};
		const maybeResolve = (): void => {
			if (Number.isFinite(video.duration)) {
				const duration = video.duration;
				done(() => resolve(duration));
			}
		};
		video.onloadedmetadata = () => maybeResolve();
		video.ondurationchange = () => maybeResolve();
		video.onerror = () => done(() => reject(new Error('Could not read this video file')));
		video.src = url;
	});
}

/** PUT raw bytes to a presigned URL with NO Content-Type header (see module
 *  doc). Progress is per-file (spinner + "Uploading i/n" step label):
 *  determinate byte progress needs XHR; fetch keeps the CORS contract
 *  simple and the progress copy honest. */
export async function putObjectBytes(
	url: string,
	data: ArrayBuffer | Uint8Array
): Promise<void> {
	// Normalise to an exact ArrayBuffer: fetch sends BufferSource bodies
	// with NO Content-Type header either way, and ArrayBuffer keeps the
	// DOM-lib BodyInit typing exact (Uint8Array generics trip it).
	const view = data instanceof Uint8Array ? data : new Uint8Array(data);
	const raw =
		view.byteOffset === 0 && view.byteLength === view.buffer.byteLength
			? view.buffer
			: view.slice().buffer;
	const res = await fetch(url, { method: 'PUT', body: raw as ArrayBuffer });
	if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
}
