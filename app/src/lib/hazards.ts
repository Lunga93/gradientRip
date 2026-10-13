// Hazard helpers — Task 3 owns isOpen, renewedExpiry, and nearLine alongside
// the Task 1 skeleton (WORST_RANK order: lower wins the explore badge).
import { HAZARD_KINDS } from './closed-sets.js';
import { haversine } from './util.js';

export { HAZARD_KINDS };

export type HazardKind = (typeof HAZARD_KINDS)[number];

// Worst-first rank: closure > unsafe > police > pothole > surface > other
// (lower wins the explore badge; Task 3 unit-tests the order).
export const WORST_RANK: Record<HazardKind, number> = {
	closure: 0,
	unsafe: 1,
	police: 2,
	pothole: 3,
	surface: 4,
	other: 5
};

const DAY_MS = 86_400_000;
const RENEW_DAYS = 7;
const CAP_DAYS = 90;

// Open means unexpired (mirrors the `expires_at > now()` open-reads filter;
// resolved hazards are expired by design — resolve sets expires_at = now()).
export interface HazardLike {
	expires_at: string | number | Date;
}

export const isOpen = (h: HazardLike, now: number = Date.now()): boolean =>
	new Date(h.expires_at).getTime() > now;

// Confirm renewal math (+7d from the current expiry snapshot, capped at
// created+90d) — mirrors the server's LEAST(expires_at + 7d, created_at + 90d).
export const renewedExpiry = (createdMs: number, expiresMs: number): number =>
	Math.min(expiresMs + RENEW_DAYS * DAY_MS, createdMs + CAP_DAYS * DAY_MS);

// Corridor check: true when the pin sits within `meters` of any line vertex
// (haversine returns meters). Callers pass resampled-line vertices; the 200 m
// planner corridor is intentionally tighter than the 2 km report gate.
export const nearLine = (
	pin: [number, number],
	line: [number, number][],
	meters: number
): boolean => {
	for (const v of line) {
		if (haversine(pin, v) <= meters) return true;
	}
	return false;
};

// Display glyphs per kind (lookup by const key — never compared as literals).
export const HAZARD_ICON: Record<HazardKind, string> = {
	closure: '⛔',
	unsafe: '⚠',
	police: '🚓',
	pothole: '🕳',
	surface: '〰',
	other: '❗'
};

export const hazardIcon = (kind: string): string =>
	(kind as HazardKind) in WORST_RANK ? HAZARD_ICON[kind as HazardKind] : '⚠';
