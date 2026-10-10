import { describe, expect, it } from 'vitest';
import { DURATION_GATE_ERROR as WORKER_GATE } from './transcode.js';
import { _DURATION_GATE_ERROR as RETRY_GATE } from '../routes/api/posts/[id]/retry/+server.js';

// The worker writes DURATION_GATE_ERROR into transcode_jobs.last_error when a
// video exceeds 60s; the retry endpoint refuses requeue by comparing
// last_error against its own copy. The two strings must stay byte-identical
// or duration-gated jobs become retryable (or vice versa).
describe('duration-gate string coupling', () => {
	it('worker gating message === retry refusal message', () => {
		expect(WORKER_GATE).toBe(RETRY_GATE);
		expect(WORKER_GATE).toBe('Video exceeds 60 seconds');
	});
});
