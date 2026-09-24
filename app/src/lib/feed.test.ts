import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { queueKudos, flushQueue } from './feed-queue.js';
import { feed } from './feed.svelte.js';

describe('feed offline queue', () => {
	it('queues while offline and flushes', () => {
		queueKudos('r1');
		expect(flushQueue()).toEqual(['r1']);
		expect(flushQueue()).toEqual([]);
	});
});

describe('flushKudos retry semantics', () => {
	const realFetch = globalThis.fetch;

	beforeEach(() => {
		flushQueue();
		feed.items = [];
		vi.restoreAllMocks();
	});
	afterEach(() => {
		globalThis.fetch = realFetch;
		flushQueue();
	});

	it('re-queues current + remainder on 5xx and stops', async () => {
		queueKudos('a');
		queueKudos('b');
		queueKudos('c');
		const fetchMock = vi.fn(async (url: unknown) => {
			if (String(url).includes('/routes/a/')) return { ok: true, status: 200 } as Response;
			return { ok: false, status: 500 } as Response;
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		await feed.flushKudos();
		expect(flushQueue()).toEqual(['b', 'c']);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('re-queues current + remainder on network throw and stops', async () => {
		queueKudos('a');
		queueKudos('b');
		queueKudos('c');
		const fetchMock = vi.fn(async (url: unknown) => {
			if (String(url).includes('/routes/a/')) return { ok: true, status: 200 } as Response;
			throw new Error('down');
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		await feed.flushKudos();
		expect(flushQueue()).toEqual(['b', 'c']);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('drops 4xx and continues with the rest', async () => {
		queueKudos('a');
		queueKudos('b');
		const fetchMock = vi.fn(async (url: unknown) => {
			if (String(url).includes('/routes/a/')) return { ok: false, status: 400 } as Response;
			return { ok: true, status: 200 } as Response;
		});
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		await feed.flushKudos();
		expect(flushQueue()).toEqual([]);
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});
});

describe('giveKudos reconciliation', () => {
	const realFetch = globalThis.fetch;

	beforeEach(() => {
		flushQueue();
		feed.items = [];
		vi.restoreAllMocks();
	});
	afterEach(() => {
		globalThis.fetch = realFetch;
		flushQueue();
	});

	it('reverts the optimistic +1 on re-kudos (kudosed:false)', async () => {
		feed.items = [{ kind: 'route', id: 'r1', title: 'R', kudos: 5 }];
		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ kudosed: false, kudos: 5 })
		})) as unknown as typeof fetch;
		await feed.giveKudos('r1');
		expect(feed.items[0].kudos).toBe(5);
		expect(flushQueue()).toEqual([]);
	});

	it('adopts the server count on first kudos', async () => {
		feed.items = [{ kind: 'route', id: 'r1', title: 'R', kudos: 5 }];
		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => ({ kudosed: true, kudos: 6 })
		})) as unknown as typeof fetch;
		await feed.giveKudos('r1');
		expect(feed.items[0].kudos).toBe(6);
		expect(flushQueue()).toEqual([]);
	});

	it('does not queue on 4xx', async () => {
		feed.items = [{ kind: 'route', id: 'r1', title: 'R', kudos: 5 }];
		globalThis.fetch = vi.fn(async () => ({
			ok: false,
			status: 400
		})) as unknown as typeof fetch;
		await feed.giveKudos('r1');
		expect(flushQueue()).toEqual([]);
	});

	it('reverts optimistic +1 and queues on 5xx', async () => {
		feed.items = [{ kind: 'route', id: 'r1', title: 'R', kudos: 5 }];
		globalThis.fetch = vi.fn(async () => ({
			ok: false,
			status: 500
		})) as unknown as typeof fetch;
		await feed.giveKudos('r1');
		expect(feed.items[0].kudos).toBe(5);
		expect(flushQueue()).toEqual(['r1']);
	});
});

describe('cached feed validation', () => {
	it('drops cached rows with bad kind or non-finite kudos', async () => {
		vi.resetModules();
		const store: Record<string, string> = {
			'gradient-feed-v1': JSON.stringify([
				{ kind: 'route', id: 'ok', title: 'OK', kudos: 3 },
				{ kind: 'bogus', id: 'bad-kind', title: 'X', kudos: 1 },
				{ kind: 'route', id: 'nan', title: 'Y', kudos: null },
				{ kind: 'event', id: 'inf', title: 'Z', kudos: Infinity }
			])
		};
		(globalThis as unknown as Record<string, unknown>).localStorage = {
			getItem: (k: string) => store[k] ?? null,
			setItem: (k: string, v: string) => {
				store[k] = v;
			}
		};
		try {
			const mod = (await import('./feed.svelte.js')) as typeof import('./feed.svelte.js');
			expect(mod.feed.items).toEqual([{ kind: 'route', id: 'ok', title: 'OK', kudos: 3 }]);
		} finally {
			delete (globalThis as unknown as Record<string, unknown>).localStorage;
			vi.resetModules();
		}
	});
});
