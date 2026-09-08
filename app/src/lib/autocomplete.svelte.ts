// Address autocomplete — debounced + throttled against Photon's public instance.
// Ported from the legacy app. Only caller: StopList.svelte.

import { autocompleteSearch } from './api.js';
import { app } from './state/app.svelte.js';

export const AC_MIN_CHARS = 3;
export const AC_DEBOUNCE_MS = 450;
export const AC_MIN_INTERVAL_MS = 500;

let acTimer: ReturnType<typeof setTimeout> | null = null;
let acController: AbortController | null = null;
let lastFetchAt = 0;

export function scheduleAutocomplete(idx: number, query: string) {
	if (acTimer) clearTimeout(acTimer);
	if (query.trim().length < AC_MIN_CHARS) { hideAcList(); return; }
	acTimer = setTimeout(() => runAutocomplete(idx, query.trim()), AC_DEBOUNCE_MS);
}

async function runAutocomplete(idx: number, query: string) {
	const wait = AC_MIN_INTERVAL_MS - (Date.now() - lastFetchAt);
	if (wait > 0) { acTimer = setTimeout(() => runAutocomplete(idx, query), wait); return; }
	if (acController) acController.abort();
	const controller = new AbortController();
	acController = controller;
	lastFetchAt = Date.now();
	try {
		const results = await autocompleteSearch(query, controller.signal);
		if (controller.signal.aborted) return;
		const stop = app.stops[idx];
		if (!stop || stop.value.trim() !== query) return;
		app.acIdx = idx; app.acResults = results; app.acActive = -1;
	} catch (err) {
		if ((err as Error).name !== 'AbortError') hideAcList();
	}
}

export function hideAcList() { app.acIdx = null; app.acResults = []; app.acActive = -1; }

export function selectAcItem(i: number) {
	const r = app.acResults[i]; const idx = app.acIdx;
	if (!r || idx == null || !app.stops[idx]) return;
	app.setStopCoords(idx, [r.lat, r.lon]);
	app.setStopValue(idx, r.label);
	hideAcList();
}

export function acHandleKeydown(e: KeyboardEvent, idx: number) {
	if (app.acIdx !== idx || !app.acResults.length) return;
	if (e.key === 'ArrowDown') { e.preventDefault(); app.acActive = Math.min(app.acActive + 1, app.acResults.length - 1); }
	else if (e.key === 'ArrowUp') { e.preventDefault(); app.acActive = Math.max(app.acActive - 1, 0); }
	else if (e.key === 'Enter' && app.acActive >= 0) { e.preventDefault(); selectAcItem(app.acActive); }
	else if (e.key === 'Escape') { hideAcList(); }
}
