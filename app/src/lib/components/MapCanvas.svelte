<script lang="ts">
	import { onMount } from 'svelte';
	import { createMap, destroyMap } from '$lib/mapController.svelte.js';
	import { initMapCenter, CT_CENTER } from '$lib/planner.svelte.js';
	import { setMapCenter } from '$lib/api.js';

	let container: HTMLDivElement;

	onMount(() => {
		let cleanup = () => {};
		createMap(container, CT_CENTER).then((m) => {
			initMapCenter((center) => {
				setMapCenter(center);
				m.setView(center, 13);
			});
			cleanup = () => destroyMap();
		});
		return () => cleanup();
	});
</script>

<div id="map" bind:this={container}></div>
