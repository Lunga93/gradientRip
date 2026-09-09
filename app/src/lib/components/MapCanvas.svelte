<script lang="ts">
	import { onMount } from 'svelte';
	import { createMap, destroyMap } from '$lib/mapController.svelte.js';
	import { initMapCenter } from '$lib/planner.svelte.js';
	import { geoState, DEFAULT_CENTER } from '$lib/geo-state.svelte.js';

	let container = $state<HTMLDivElement | undefined>(undefined);

	onMount(() => {
		const el = container;
		if (!el) return;
		let cleanup = () => {};
		createMap(el, DEFAULT_CENTER).then((m) => {
			initMapCenter((center) => {
				geoState.setCenter(center);
				m.setView(center, 13);
			});
			cleanup = () => destroyMap();
		});
		return () => cleanup();
	});
</script>

<div id="map" bind:this={container}></div>
