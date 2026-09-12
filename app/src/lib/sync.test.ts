import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tripToRow, rowToTrip, rowToPreset, pushBackup, fetchBackup } from './sync.js';
import type { Trip, Preset } from './storage.js';

const trip = (over: Partial<Trip> = {}): Trip => ({
	ts: 1726000000000,
	modeId: 'eskate',
	boardVal: '336|30|12',
	queries: ['A', 'B'],
	coords: [[-33.9, 18.4], [-33.91, 18.41]],
	line: [[-33.9, 18.4], [-33.905, 18.405], [-33.91, 18.41]],
	pts: [[-33.9, 18.4], [-33.905, 18.405]],
	elev: [10, 12, 11],
	cum: [0, 550, 1100],
	totalWh: 21.4,
	totalClimb: 2,
	usableWh: 292.3,
	climbLimit: 30,
	brakeLimit: 12,
	totalKm: 1.1,
	...over
});

const tripRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
	ts: 1726000000000,
	mode_id: 'eskate',
	board_val: '336|30|12',
	queries: ['A', 'B'],
	coords: [[-33.9, 18.4], [-33.91, 18.41]],
	line: [[-33.9, 18.4], [-33.905, 18.405], [-33.91, 18.41]],
	pts: [[-33.9, 18.4], [-33.905, 18.405]],
	elev: ['10', '12', '11'], // pg NUMERIC arrives as strings
	cum: ['0', '550', '1100'],
	total_wh: '21.4',
	total_climb: '2',
	usable_wh: '292.3',
	climb_limit: '30',
	brake_limit: '12',
	total_km: '1.1',
	drawn: false,
	recorded: false,
	...over
});

describe('tripToRow', () => {
	it('maps camelCase domain Trip to the API row shape', () => {
		const row = tripToRow(trip()) as Record<string, unknown>;
		expect(row.modeId).toBe('eskate');
		expect(row.totalWh).toBe(21.4);
		expect(row.total_km).toBeUndefined();
		expect(row.drawn).toBe(false);
		expect(row.recorded).toBe(false);
	});

	it('normalises absent drawn/recorded flags to false', () => {
		const row = tripToRow(trip({ drawn: undefined, recorded: undefined })) as Record<string, unknown>;
		expect(row.drawn).toBe(false);
		expect(row.recorded).toBe(false);
	});
});

describe('rowToTrip', () => {
	it('maps snake_case row back and coerces pg numeric strings', () => {
		const t = rowToTrip(tripRow() as never);
		expect(t.modeId).toBe('eskate');
		expect(t.totalWh).toBeCloseTo(21.4);
		expect(t.totalKm).toBeCloseTo(1.1);
		expect(t.elev).toEqual([10, 12, 11]);
		expect(t.cum).toEqual([0, 550, 1100]);
		expect(t.drawn).toBeUndefined();
	});

	it('keeps drawn/recorded when true', () => {
		const t = rowToTrip(tripRow({ drawn: true }) as never);
		expect(t.drawn).toBe(true);
	});

	it('survives null geometry arrays', () => {
		const t = rowToTrip(tripRow({ coords: null, line: null, elev: null, cum: null, queries: null }) as never);
		expect(t.coords).toEqual([]);
		expect(t.line).toEqual([]);
		expect(t.elev).toEqual([]);
		expect(t.queries).toEqual([]);
	});
});

describe('rowToPreset', () => {
	it('scopes db ids negative so they never collide with local ids', () => {
		const p = rowToPreset({ id: 42, label: 'Home', query: 'Home, Cape Town', coords: [-33.9, 18.4] });
		expect(p.id).toBe(-43);
		expect(p.label).toBe('Home');
		expect(p.coords).toEqual([-33.9, 18.4]);
	});

	it('nulls malformed coords', () => {
		const p = rowToPreset({ id: 7, label: 'X', query: 'X', coords: [1] as unknown as [number, number] });
		expect(p.coords).toBeNull();
	});
});

describe('pushBackup / fetchBackup', () => {
	const realFetch = globalThis.fetch;

	beforeEach(() => vi.restoreAllMocks());
	afterEach(() => {
		globalThis.fetch = realFetch;
	});

	it('pushBackup posts mapped rows to /api/sync and returns ok status', async () => {
		const fetchMock = vi.fn(async () => ({ ok: true }) as Response);
		globalThis.fetch = fetchMock as unknown as typeof fetch;
		const presets: Preset[] = [{ id: 1, label: 'L', query: 'Q', coords: null }];
		const ok = await pushBackup([trip()], presets);
		expect(ok).toBe(true);
		const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
		expect(url).toBe('/api/sync');
		expect(init.method).toBe('POST');
		const body = JSON.parse(init.body as string);
		expect(body.trips[0].modeId).toBe('eskate');
		expect(body.presets[0].query).toBe('Q');
	});

	it('pushBackup fails soft on network error', async () => {
		globalThis.fetch = vi.fn(async () => {
			throw new Error('down');
		}) as unknown as typeof fetch;
		expect(await pushBackup([trip()], [])).toBe(false);
	});

	it('fetchBackup returns null when an endpoint fails', async () => {
		globalThis.fetch = vi.fn(async () => ({ ok: false }) as Response) as unknown as typeof fetch;
		expect(await fetchBackup()).toBeNull();
	});

	it('fetchBackup maps both endpoints', async () => {
		globalThis.fetch = (async (input: RequestInfo | URL) =>
			String(input).includes('/api/trips')
				? ({ ok: true, json: async () => [tripRow()] } as Response)
				: ({ ok: true, json: async () => [{ id: 5, label: 'P', query: 'P', coords: null }] } as Response)) as typeof fetch;
		const out = await fetchBackup();
		expect(out?.trips[0].modeId).toBe('eskate');
		expect(out?.presets[0].id).toBe(-6);
	});
});
