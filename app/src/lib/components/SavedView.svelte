<script lang="ts">
	import SavedTrips from '$lib/components/SavedTrips.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="view {ui.activeTab === 'saved' ? 'active' : ''} p-4">
	<h2 class="mb-1 text-[1.15rem] font-bold text-base-content">Saved trips</h2>
	<p class="mb-4 text-[0.8rem] text-base-content/55">Open offline — no connection needed.</p>
	<SavedTrips />
</div>
