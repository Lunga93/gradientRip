import { describe, expect, it } from 'vitest';
import { queueKudos, flushQueue } from './feed-queue.js';

describe('feed offline queue', () => {
	it('queues while offline and flushes', () => {
		queueKudos('r1');
		expect(flushQueue()).toEqual(['r1']);
		expect(flushQueue()).toEqual([]);
	});
});
