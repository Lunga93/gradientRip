// Address autocomplete — debounced + throttled against Photon's public instance.
// Ported from the legacy app. Only caller: StopList.svelte.

import { autocompleteSearch } from './api.js';
import { geoState } from './geo-state.svelte.js';
import { domain } from './state/domain.svelte.js';
import { session } from './state/session.svelte.js';

export const AC_MIN_CHARS = 3;
export const AC_DEBOUNCE_MS = 450;
export const AC_MIN_INTERVAL_MS = 500;

// Per-field debounce timers + controllers: typing in field B must not cancel
// field A's in-flight request. Throttle clock stays global (Photon rate).
// Plain records (not reactive Maps) — these are request bookkeeping, never UI.
const acTimers: Record<number, ReturnType<typeof setTimeout> | undefined> = {};
const acControllers: Record<number, AbortController | undefined> = {};
const acSeq: Record<number, number | undefined> = {};
let lastFetchAt = 0;

export const hideAcList = (): void => { session.acIdx = null; session.acResults = []; session.acActive = -1; };

export const scheduleAutocomplete = (idx: number, query: string): void => {
	const pending = acTimers[idx];
	if (pending) clearTimeout(pending);
	const clean = query.replace(/[\p{Cc}]/gu, ' ').replace(/\s+/g, ' ').trim();
	if (clean.length < AC_MIN_CHARS) {
		if (session.acIdx === idx) hideAcList();
		return;
	}
	acTimers[idx] = setTimeout(() => runAutocomplete(idx, clean), AC_DEBOUNCE_MS);
};

const runAutocomplete = async (idx: number, query: string): Promise<void> => {
	const wait = AC_MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
	if (wait > 0) {
		acTimers[idx] = setTimeout(() => runAutocomplete(idx, query), wait);
		return;
	}
	const seq = (acSeq[idx] ?? 0) + 1;
	acSeq[idx] = seq;
	acControllers[idx]?.abort();
	const controller = new AbortController();
	acControllers[idx] = controller;
	lastFetchAt = Date.now();
	try {
		const results = await autocompleteSearch(query, controller.signal, geoState.center, geoState.country);
		if (controller.signal.aborted) return;
		// Discard stale responses: only the latest request per field may publish.
		if (acSeq[idx] !== seq) return;
		const stop = domain.stops[idx];
		if (!stop || stop.value.trim() !== query) return;
		session.acIdx = idx; session.acResults = results; session.acActive = -1;
	} catch (err) {
		if ((err as Error).name !== 'AbortError' && acSeq[idx] === seq) hideAcList();
	}
};

export const selectAcItem = (i: number): void => {
	const r = session.acResults[i]; const idx = session.acIdx;
	if (!r || idx == null || !domain.stops[idx]) return;
	domain.setStopValue(idx, r.label.replace(/\s+/g, ' ').trim(), true);
	domain.setStopCoords(idx, [r.lat, r.lon]);
	hideAcList();
};

export const acHandleKeydown = (e: KeyboardEvent, idx: number): void => {
	if (session.acIdx !== idx || !session.acResults.length) return;
	if (e.key === 'ArrowDown') { e.preventDefault(); session.acActive = Math.min(session.acActive + 1, session.acResults.length - 1); }
	else if (e.key === 'ArrowUp') { e.preventDefault(); session.acActive = Math.max(session.acActive - 1, -1); }
	else if (e.key === 'Enter' && session.acActive >= 0) { e.preventDefault(); selectAcItem(session.acActive); }
	else if (e.key === 'Escape') { hideAcList(); }
};
