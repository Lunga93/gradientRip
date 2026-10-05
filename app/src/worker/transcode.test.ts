import { describe, expect, it, vi } from 'vitest';
import { posterSeekSeconds, processJob } from './transcode.js';
import type { Pool } from 'pg';

describe('posterSeekSeconds', () => {
	it('uses the midpoint for sub-second videos', () => {
		expect(posterSeekSeconds(0.4)).toBeCloseTo(0.2);
	});

	it('keeps the verbatim 1s seek for normal videos', () => {
		expect(posterSeekSeconds(30)).toBe(1);
	});
});

describe('processJob orphan-after-claim', () => {
	it('fails (not strands) a claimed job whose post/source vanished', async () => {
		const calls: Array<{ sql: string; params: unknown[] }> = [];
		const pool = {
			query: vi.fn(async (sql: string, params: unknown[] = []) => {
				calls.push({ sql, params });
				return { rows: [] };
			})
		} as unknown as Pool;
		await processJob(pool, '00000000-0000-0000-0000-000000000000');
		expect(calls).toHaveLength(2);
		expect(calls[1].sql).toContain("status='failed'");
		expect(calls[1].sql).toContain('post or source vanished');
		expect(calls[1].params).toEqual(['00000000-0000-0000-0000-000000000000']);
	});
});
