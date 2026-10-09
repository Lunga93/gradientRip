<script lang="ts">
	import SavedTrips from '$lib/components/SavedTrips.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="view {ui.activeTab === 'saved' ? 'active' : ''} p-5">
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold">Saved trips</h2>
	<p class="m-0 mb-4 text-[0.8rem] text-base-content/70">Open offline — no connection needed.</p>
	<SavedTrips />
</div>
