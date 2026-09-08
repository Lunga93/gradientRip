// localStorage persistence — ported verbatim from the legacy app.
// Same keys, so existing users' saved data carries over.

export const PRESETS_KEY = 'gradient-presets-v1';
export const TRIPS_KEY = 'gradient-trips-v1';
export const TRANSPORT_KEY = 'gradient-transport-v1';
export const LEGAL_KEY = 'gradient-legal-v1';
export const COLLAPSE_KEY_PREFIX = 'gradient-collapsed-';
export const TRIPS_MAX = 15;

export interface Preset {
	id: number;
	label: string;
	query: string;
	coords: [number, number] | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Trip extends Record<string, any> {
	ts: number;
	modeId: string;
	boardVal: string;
	queries: string[];
	coords: [number, number][];
	line: [number, number][];
	pts: [number, number][];
	elev: number[];
	cum: number[];
	totalWh: number;
	totalClimb: number;
	usableWh: number;
	climbLimit: number;
	brakeLimit: number;
	totalKm: number;
	drawn?: boolean;
	recorded?: boolean;
}

export function loadJSON<T>(key: string, fallback: T): T {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
}

export function saveJSON(key: string, value: unknown): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// storage unavailable — value just won't persist
	}
}

export function loadPresets(): Preset[] {
	return loadJSON<Preset[]>(PRESETS_KEY, []);
}

export function savePresets(list: Preset[]): void {
	saveJSON(PRESETS_KEY, list);
}

export function loadTrips(): Trip[] {
	return loadJSON<Trip[]>(TRIPS_KEY, []);
}

export function saveTrips(list: Trip[]): void {
	try {
		localStorage.setItem(TRIPS_KEY, JSON.stringify(list.slice(0, TRIPS_MAX)));
	} catch {
		// storage full or unavailable — trip just won't persist
	}
}

export function loadMode(): string {
	try {
		const id = localStorage.getItem(TRANSPORT_KEY);
		return id ?? '';
	} catch {
		return '';
	}
}

export function saveMode(id: string): void {
	try {
		localStorage.setItem(TRANSPORT_KEY, id);
	} catch {
		// storage unavailable
	}
}

export function loadCollapsed(storageKey: string): boolean {
	try {
		return localStorage.getItem(COLLAPSE_KEY_PREFIX + storageKey) === '1';
	} catch {
		return false; // default open
	}
}

export function saveCollapsed(storageKey: string, collapsed: boolean): void {
	try {
		localStorage.setItem(COLLAPSE_KEY_PREFIX + storageKey, collapsed ? '1' : '0');
	} catch {
		// not persisted this time
	}
}

export function loadLegalDismissed(): boolean {
	try {
		return localStorage.getItem(LEGAL_KEY) === '1';
	} catch {
		return false;
	}
}

export function setLegalDismissed(): void {
	try {
		localStorage.setItem(LEGAL_KEY, '1');
	} catch {
		// ignore
	}
}

export function clearLegalDismissed(): void {
	try {
		localStorage.removeItem(LEGAL_KEY);
	} catch {
		// ignore
	}
}
