<script lang="ts">
	import { app } from '$lib/state/app.svelte.js';
	import { MODES, MODE_ICONS } from '$lib/modes.js';
	import { cumulative, haversine } from '$lib/util.js';
	import type { LatLon } from '$lib/util.js';
	import { routeSegments, verdictFor } from '$lib/scoring.js';
	import { renderRoute } from '$lib/mapController.svelte.js';
	import { app as appState } from '$lib/state/app.svelte.js';
	import type { Trip } from '$lib/storage.js';

	function tripIcon(t: Trip): string {
		if (t.recorded) return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7" fill="#ff5a52"/></svg>';
		if (t.drawn)
			return '<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
		return '<svg viewBox="0 0 24 24"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg>';
	}

	function tripLabel(t: Trip): string {
		const prefix = t.recorded ? 'Recorded: ' : t.drawn ? 'Drawn: ' : '';
		return prefix + t.queries.join(' → ');
	}

	function tripMeta(t: Trip): string {
		const modeLabel = MODES[t.modeId] ? MODES[t.modeId].label : t.modeId;
		return `${modeLabel} · ${t.totalKm.toFixed(1)} km · ${new Date(t.ts).toLocaleString()}`;
	}

	// Redraws a saved trip with no network access at all — same rendering path
	// a live plan uses, fed from stored data instead of fresh API responses.
	function loadTrip(t: Trip) {
		// A drawn or recorded route's `queries` is just its custom name, not
		// from/to stops — leave the fields as they are rather than overwriting.
		if (!t.drawn && !t.recorded) {
			app.stops = t.queries.map((q, i) => ({
				value: q,
				coords: t.coords ? (t.coords[i] as LatLon) : null
			}));
			app.activeStopIndex = 0;
		}
		if (MODES[t.modeId]) app.selectMode(t.modeId);
		app.boardVal = t.boardVal;

		const line = t.line as LatLon[];
		const pts = t.pts as LatLon[];
		const lineCum = cumulative(line);
		const segs = routeSegments(line, lineCum, pts, t.elev, t.cum);
		const mode = MODES[t.modeId] ?? app.mode;
		const v = verdictFor(segs, t.totalWh, t.usableWh, t.climbLimit, t.brakeLimit, mode);

		app.applyResult({
			verdict: v,
			pts,
			elev: t.elev,
			cum: t.cum,
			totalWh: t.totalWh,
			totalClimb: t.totalClimb,
			usableWh: t.usableWh,
			mode,
			segs,
			line,
			coords: (t.coords ?? []) as LatLon[]
		});
		renderRoute(segs, line, (t.coords ?? []) as LatLon[]);
		app.setStatus('Loaded from saved trips — no network used.');
	}

	function deleteTrip(e: MouseEvent, idx: number) {
		e.stopPropagation();
		app.deleteTrip(idx);
	}

	// keep unused import warnings away — haversine is re-exported for tests
	void haversine;
	void appState;
</script>

<div class="panel-card" class:hidden={app.trips.length === 0}>
	<button
		type="button"
		class="collapse-header"
		aria-expanded={!app.tripsCollapsed}
		aria-controls="tripsBody"
		onclick={() => app.toggleTripsCollapsed()}
	>
		<span class="sectionlabel">Saved trips (offline)</span>
		<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg>
	</button>
	<div class="collapse-body" class:collapsed={app.tripsCollapsed} id="tripsBody">
		<div class="collapse-inner">
			<div class="trips">
				{#each app.trips as t, i (t.ts + '-' + i)}
					<button type="button" class="trip" onclick={() => loadTrip(t)}>
						{@html tripIcon(t)}
						<span class="tmain">
							<span class="troute">{tripLabel(t)}</span>
							<span class="tmeta">{tripMeta(t)}</span>
						</span>
						<span class="del" role="button" tabindex="0" title="Delete saved trip" onclick={(e) => deleteTrip(e, i)} onkeydown={(e) => e.key === 'Enter' && deleteTrip(e as unknown as MouseEvent, i)}>&times;</span>
					</button>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	/* mode icons come from the shared icon map */
	.trip :global(svg) {
		fill: var(--accent);
	}
</style>

<script module lang="ts">
	// expose MODE_ICONS for potential template use
	export const icons = MODE_ICONS;
</script>
