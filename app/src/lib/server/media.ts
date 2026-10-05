// S3 media storage (server-only). The ONLY server module touching S3.
// Uploads go via presigned PUTs (15 min), serving via presigned GETs (1 h)
// embedded in feed/detail responses, so friends-only media is never URL-public.
// Keys are ALWAYS <userId>/<uuid>.<ext> — anything else is rejected.
import {
	S3Client,
	HeadBucketCommand,
	CreateBucketCommand,
	HeadObjectCommand,
	DeleteObjectsCommand,
	PutObjectCommand,
	GetObjectCommand,
	CopyObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';

const BUCKET = env.S3_BUCKET || process.env.S3_BUCKET || 'gradientrip-media';
const REGION = env.S3_REGION || process.env.S3_REGION || 'us-east-1';

export const PUT_EXPIRES_IN = 900;
export const GET_EXPIRES_IN = 3600;

let client: S3Client | null = null;
export const s3 = (): S3Client => {
	if (!client) {
		client = new S3Client({
			region: REGION,
			endpoint: env.S3_ENDPOINT || process.env.S3_ENDPOINT,
			forcePathStyle: true,
			credentials: {
				accessKeyId: env.S3_ACCESS_KEY || process.env.S3_ACCESS_KEY || '',
				secretAccessKey: env.S3_SECRET_KEY || process.env.S3_SECRET_KEY || ''
			}
		});
	}
	return client;
};

export const mediaKey = (userId: string, ext: string): string => `${userId}/${randomUUID()}.${ext}`;

export const assertOwnedKey = (userId: string, key: string): void => {
	if (!key.startsWith(`${userId}/`) || key.includes('..')) throw new Error('foreign key');
};

// Full key-shape gate: <userId>/<uuid>.<ext>, no path escapes. presignPut and
// friends reject anything else, so callers cannot mint URLs outside the namespace.
const KEY_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]+$/i;

export const assertValidKey = (key: string): void => {
	if (!KEY_RE.test(key) || key.includes('..')) throw new Error('invalid key');
};

const statusOf = (e: unknown): number | undefined =>
	(e as { $metadata?: { httpStatusCode?: number } } | null)?.$metadata?.httpStatusCode;

const nameOf = (e: unknown): string | undefined =>
	(e as { name?: string } | null)?.name;

export const ensureBucket = async (): Promise<void> => {
	try {
		await s3().send(new HeadBucketCommand({ Bucket: BUCKET }));
	} catch (e: unknown) {
		if (statusOf(e) === 404 || nameOf(e) === 'NotFound') {
			await s3().send(new CreateBucketCommand({ Bucket: BUCKET }));
			return;
		}
		throw e;
	}
};

// presignPut mints an UNSIGNED-payload PUT URL: ContentType/ContentLength are
// deliberately NOT embedded in the PutObjectCommand signature. WHY: MinIO here
// rejects PutBucketCors (501) and its preflight answers Allow-Origin +
// Allow-Methods PUT but NO Allow-Headers, so a browser PUT carrying a
// non-safelisted header like Content-Type fails preflight. The browser
// (Task 5 composer) must send raw bytes with NO Content-Type header.
// contentType/bytes params are still validated at mint time (cap checks live
// in the upload-urls endpoint); they just aren't part of the SigV4 signature.
export const presignPut = async (
	key: string,
	contentType: string,
	bytes: number
): Promise<{ url: string; key: string; expiresIn: number }> => {
	assertValidKey(key);
	if (!contentType || typeof contentType !== 'string') throw new Error('contentType required');
	if (!Number.isInteger(bytes) || bytes <= 0) throw new Error('bytes must be a positive integer');
	const url = await getSignedUrl(
		s3(),
		new PutObjectCommand({
			Bucket: BUCKET,
			Key: key
		}),
		{ expiresIn: PUT_EXPIRES_IN }
	);
	return { url, key, expiresIn: PUT_EXPIRES_IN };
};

// Server-controlled ext -> content-type map. setContentType/post-create take
// their type from here, never raw client input.
export const contentTypeForExt = (ext: string): string | null => {
	const e = ext.trim().replace(/^\.+/, '').toLowerCase();
	switch (e) {
		case 'jpg':
		case 'jpeg':
			return 'image/jpeg';
		case 'png':
			return 'image/png';
		case 'webp':
			return 'image/webp';
		case 'mp4':
			return 'video/mp4';
		case 'mov':
			return 'video/quicktime';
		default:
			return null;
	}
};

// Post-upload fixup: the object was PUT header-less (no Content-Type, see
// presignPut), so copy it onto itself with the validated type. contentType
// must come from contentTypeForExt(), never directly from client input.
// Task 4's post-create calls this after upload, then HEAD-verifies.
export const setContentType = async (key: string, contentType: string): Promise<void> => {
	assertValidKey(key);
	if (!contentType || typeof contentType !== 'string') throw new Error('contentType required');
	await s3().send(
		new CopyObjectCommand({
			Bucket: BUCKET,
			CopySource: `${BUCKET}/${key}`,
			Key: key,
			MetadataDirective: 'REPLACE',
			ContentType: contentType
		})
	);
};

export const presignGet = async (key: string): Promise<string> => {
	assertValidKey(key);
	return getSignedUrl(s3(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
		expiresIn: GET_EXPIRES_IN
	});
};

export const headObject = async (
	key: string
): Promise<{ bytes: number; contentType: string } | null> => {
	assertValidKey(key);
	try {
		const out = await s3().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
		return {
			bytes: out.ContentLength ?? 0,
			contentType: out.ContentType ?? 'application/octet-stream'
		};
	} catch (e: unknown) {
		if (statusOf(e) === 404 || nameOf(e) === 'NotFound' || nameOf(e) === 'NoSuchKey') {
			return null;
		}
		throw e;
	}
};

export const deleteObjects = async (keys: string[]): Promise<void> => {
	if (keys.length === 0) return;
	for (const key of keys) assertValidKey(key);
	await s3().send(
		new DeleteObjectsCommand({
			Bucket: BUCKET,
			Delete: { Objects: keys.map((Key) => ({ Key })) }
		})
	);
};
