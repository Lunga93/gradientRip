<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import {
		createMap,
		destroyMap,
		renderRoute,
		redrawDrawLayer,
		setDrawCursor,
		redrawRecordLayer,
		updateRecordMarker
	} from '$lib/mapController.svelte.js';
	import { initMapCenter } from '$lib/planner.svelte.js';
	import { geoState, DEFAULT_CENTER } from '$lib/geo-state.svelte.js';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { verdictHex } from '$lib/verdictTheme.js';

	let container = $state<HTMLDivElement | undefined>(undefined);
	// The Leaflet import is async — if the route unmounts before createMap
	// resolves, destroy the just-created map instead of leaking it.
	let cancelled = $state(false);

	onMount(() => {
		const el = container;
		if (!el) return;
		createMap(el, DEFAULT_CENTER).then((m) => {
			if (cancelled || !container?.isConnected) {
				destroyMap();
				return;
			}
			initMapCenter((center) => {
				if (cancelled) return;
				geoState.setCenter(center);
				m.setView(center, 13);
			});
			// Remount restore: the controller drops every Leaflet layer with
			// map.remove(), but domain/session module state persists — redraw
			// the scored route and any in-progress draw/record trace so a tab
			// switch doesn't blank the map.
			const res = domain.results;
			if (res && res.line.length > 1) {
				renderRoute(res.segs, res.line, res.coords, verdictHex(res.verdict.level));
			}
			if (session.drawMode) {
				setDrawCursor(true);
				redrawDrawLayer();
			}
			if (session.recordMode && session.recordPoints.length > 0) {
				redrawRecordLayer();
				const tail = session.recordPoints[session.recordPoints.length - 1];
				if (tail) updateRecordMarker(tail, true);
			}
		});
	});

	// Tab switches unmount this component — remove listeners and the map so
	// the next mount starts from exactly one clean instance.
	onDestroy(() => {
		cancelled = true;
		destroyMap();
	});
</script>

<div id="map" bind:this={container}></div>
