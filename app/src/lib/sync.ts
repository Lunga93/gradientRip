// Cloud backup — mirrors saved trips and presets to Postgres through the
// /api/* endpoints (device-cookie scoped, RLS-isolated per user row).
//
// Design matches the app's offline-first philosophy:
//  - localStorage stays the source of truth and always works offline;
//  - pushes are debounced + best-effort (failures are silent, retried later);
//  - restore only fills an EMPTY local store — cloud never overwrites local.
import type { Trip, Preset } from './storage.js';

/* ---------- row <-> domain mapping (pure, unit-tested) ---------- */

// pg returns NUMERIC/BIGINT columns as strings — coerce back to numbers.
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);

interface TripRow {
	ts: unknown;
	mode_id: string;
	board_val: string;
	queries: string[];
	coords: [number, number][];
	line: [number, number][];
	pts: [number, number][];
	elev: unknown[];
	cum: unknown[];
	total_wh: unknown;
	total_climb: unknown;
	usable_wh: unknown;
	climb_limit: unknown;
	brake_limit: unknown;
	total_km: unknown;
	drawn: boolean | null;
	recorded: boolean | null;
	shared: boolean | null;
}

export const tripToRow = (t: Trip): Record<string, unknown> => ({
	ts: t.ts,
	modeId: t.modeId,
	boardVal: t.boardVal,
	queries: t.queries,
	coords: t.coords,
	line: t.line,
	pts: t.pts,
	elev: t.elev,
	cum: t.cum,
	totalWh: t.totalWh,
	totalClimb: t.totalClimb,
	usableWh: t.usableWh,
	climbLimit: t.climbLimit,
	brakeLimit: t.brakeLimit,
	totalKm: t.totalKm,
	drawn: t.drawn ?? false,
	recorded: t.recorded ?? false
});

export const rowToTrip = (r: TripRow): Trip => ({
	ts: num(r.ts),
	modeId: r.mode_id,
	boardVal: r.board_val,
	queries: r.queries ?? [],
	coords: r.coords ?? [],
	line: r.line ?? [],
	pts: r.pts ?? [],
	elev: (r.elev ?? []).map(num),
	cum: (r.cum ?? []).map(num),
	totalWh: num(r.total_wh),
	totalClimb: num(r.total_climb),
	usableWh: num(r.usable_wh),
	climbLimit: num(r.climb_limit),
	brakeLimit: num(r.brake_limit),
	totalKm: num(r.total_km),
	drawn: r.drawn || undefined,
	recorded: r.recorded || undefined,
	shared: r.shared || undefined
});

interface PresetRow {
	id: unknown;
	label: string;
	query: string;
	coords: [number, number] | null;
}

// Preset ids are BIGSERIAL in Postgres but Date.now()+random locally — scope
// restored rows to negative ids so they can never collide with local ones and
// will be re-saved with fresh local ids the first time the user edits them.
export const rowToPreset = (r: PresetRow): Preset => ({
	id: -Math.abs(num(r.id)) - 1,
	label: r.label,
	query: r.query,
	coords: Array.isArray(r.coords) && r.coords.length === 2 ? r.coords : null
});

/* ---------- push / restore (network, best-effort) ---------- */

// Debounced mirror of the latest local state — mutations call scheduleBackup
// with a snapshot; only the most recent payload within the window is pushed.
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pending: { trips: Trip[]; presets: Preset[] } | null = null;

export const scheduleBackup = (trips: Trip[], presets: Preset[]): void => {
	if (typeof window === 'undefined') return;
	pending = { trips, presets };
	if (pushTimer) clearTimeout(pushTimer);
	pushTimer = setTimeout(() => {
		pushTimer = null;
		if (pending) void pushBackup(pending.trips, pending.presets);
		pending = null;
	}, 2500);
};

export const pushBackup = async (trips: Trip[], presets: Preset[]): Promise<boolean> => {
	// Strictly `=== false`: some environments (node, SSR-ish) expose navigator
	// without onLine — treating undefined as offline would silently skip sync.
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
	try {
		const resp = await fetch('/api/sync', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				trips: trips.map(tripToRow),
				presets: presets.map((p) => ({
					label: p.label,
					query: p.query,
					coords: p.coords
				}))
			})
		});
		return resp.ok;
	} catch {
		return false;
	}
};

export const fetchBackup = async (): Promise<{ trips: Trip[]; presets: Preset[] } | null> => {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
	try {
		const [tripsResp, presetsResp] = await Promise.all([
			fetch('/api/trips?limit=50'),
			fetch('/api/presets')
		]);
		if (!tripsResp.ok || !presetsResp.ok) return null;
		const tripRows = (await tripsResp.json()) as TripRow[];
		const presetRows = (await presetsResp.json()) as PresetRow[];
		return {
			trips: tripRows.map(rowToTrip),
			presets: presetRows.map(rowToPreset)
		};
	} catch {
		return null;
	}
};
