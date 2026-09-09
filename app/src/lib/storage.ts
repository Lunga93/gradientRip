export const PRESETS_KEY = 'gradient-presets-v1';
export const TRIPS_KEY = 'gradient-trips-v1';
export const TRANSPORT_KEY = 'gradient-transport-v1';
export const LEGAL_KEY = 'gradient-legal-v1';
export const THEME_KEY = 'gradient-theme-v1';
export const BOARD_KEY = 'gradient-board-v1';
export const LOCATION_KEY = 'gradient-location-v1';
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

export const loadJSON = <T,>(key: string, fallback: T): T => {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as T) : fallback;
	} catch {
		return fallback;
	}
};

export const saveJSON = (key: string, value: unknown): void => {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* storage unavailable (private mode / quota) — persistence is best-effort */
	}
};

export const loadPresets = (): Preset[] => loadJSON<Preset[]>(PRESETS_KEY, []);

export const savePresets = (list: Preset[]): void => {
	saveJSON(PRESETS_KEY, list);
};

export const loadTrips = (): Trip[] => loadJSON<Trip[]>(TRIPS_KEY, []);

export const saveTrips = (list: Trip[]): void => {
	try {
		localStorage.setItem(TRIPS_KEY, JSON.stringify(list.slice(0, TRIPS_MAX)));
	} catch {
		/* best-effort, as above */
	}
};

const getItem = (key: string): string => {
	try {
		return localStorage.getItem(key) ?? '';
	} catch {
		return '';
	}
};

const setItem = (key: string, value: string): void => {
	try {
		localStorage.setItem(key, value);
	} catch {
		/* best-effort */
	}
};

export const loadMode = (): string => getItem(TRANSPORT_KEY);
export const saveMode = (id: string): void => { setItem(TRANSPORT_KEY, id); };
export const loadBoard = (): string => getItem(BOARD_KEY);
export const saveBoard = (value: string): void => { setItem(BOARD_KEY, value); };

export interface KnownLocation {
	lat: number;
	lon: number;
	label: string;
	ts: number;
}

export const loadKnownLocation = (): KnownLocation | null =>
	loadJSON<KnownLocation | null>(LOCATION_KEY, null);

export const saveKnownLocation = (loc: KnownLocation): void => {
	saveJSON(LOCATION_KEY, loc);
};

export const loadLegalDismissed = (): boolean => getItem(LEGAL_KEY) === '1';
export const setLegalDismissed = (): void => {
	setItem(LEGAL_KEY, '1');
};
export const clearLegalDismissed = (): void => {
	try {
		localStorage.removeItem(LEGAL_KEY);
	} catch {
		/* best-effort */
	}
};

export type ThemePref = 'auto' | 'light' | 'dark';

const validTheme = (v: string): ThemePref => (v === 'light' || v === 'dark' ? v : 'auto');
export const loadThemePref = (): ThemePref => validTheme(getItem(THEME_KEY));
export const saveThemePref = (pref: ThemePref): void => {
	if (pref === 'auto') {
		try {
			localStorage.removeItem(THEME_KEY);
		} catch {
			/* best-effort */
		}
	} else setItem(THEME_KEY, pref);
};