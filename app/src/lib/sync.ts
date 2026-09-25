import type { Trip, Preset } from './storage.js';
import { parseHome, parseSports, parseUnits } from './profiles/profile.js';


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

export const rowToPreset = (r: PresetRow): Preset => ({
	id: -Math.abs(num(r.id)) - 1,
	label: r.label,
	query: r.query,
	coords: Array.isArray(r.coords) && r.coords.length === 2 ? r.coords : null
});


// Onboarding prefs mirrored to the cloud. Scopes follow the endpoints:
// sports/units ride the device-cookie /api/prefs; sports/units/home ride the
// Google-auth /api/profile (401 when signed out is ignored). The /api/sync
// body stays trips+presets — its prefs branch has no sports/units/home
// columns and would just upsert nulls.
export interface HomeFix {
	lat: number;
	lon: number;
	label: string;
}

export interface PrefsBackup {
	sports: string[];
	units: string;
	home: HomeFix | null;
}

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

export const pushBackup = async (
	trips: Trip[],
	presets: Preset[],
	prefs?: PrefsBackup | null
): Promise<boolean> => {
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
		if (prefs) await pushPrefs(prefs);
		return resp.ok;
	} catch {
		return false;
	}
};

// Best-effort prefs mirror — failures are silent (offline, signed out, or
// endpoints down all just stay local-only). Never throws.
export const pushPrefs = async (prefs: PrefsBackup): Promise<void> => {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
	const json = { 'Content-Type': 'application/json' };
	try {
		await fetch('/api/prefs', {
			method: 'PUT',
			headers: json,
			body: JSON.stringify({ sports: prefs.sports, units: prefs.units })
		});
	} catch {
		/* stay local-only */
	}
	try {
		await fetch('/api/profile', {
			method: 'PUT',
			headers: json,
			body: JSON.stringify({ sports: prefs.sports, units: prefs.units, home: prefs.home })
		});
	} catch {
		/* signed out or unreachable — device prefs above still landed */
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

// Remote onboarding prefs: device-scoped /api/prefs first, then the
// Google-auth /api/profile overlays sports/home/units when signed in
// (401 → skipped). Sanitised through the Task 1 validators. Null when
// offline or when neither endpoint answers.
export const fetchPrefs = async (): Promise<PrefsBackup | null> => {
	if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
	let out: PrefsBackup | null = null;
	try {
		const resp = await fetch('/api/prefs');
		if (resp.ok) {
			const p = (await resp.json()) as { sports?: unknown; units?: unknown };
			out = {
				sports: parseSports(p.sports),
				units: typeof p.units === 'string' ? parseUnits(p.units) : 'km',
				home: null
			};
		}
	} catch {
		/* stay local-only */
	}
	try {
		const resp = await fetch('/api/profile');
		if (resp.ok) {
			const p = (await resp.json()) as { sports?: unknown; units?: unknown; home?: unknown };
			const sports = parseSports(p.sports);
			const home = parseHome(p.home);
			if (out) {
				if (sports.length > 0) out.sports = sports;
				if (home) out.home = home;
				if (typeof p.units === 'string') out.units = parseUnits(p.units);
			} else if (sports.length > 0 || home) {
				out = {
					sports,
					units: typeof p.units === 'string' ? parseUnits(p.units) : 'km',
					home
				};
			}
		}
	} catch {
		/* signed out — device prefs above still apply */
	}
	return out;
};
