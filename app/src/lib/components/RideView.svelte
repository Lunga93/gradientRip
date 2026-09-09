<script lang="ts">
	import { Activity } from '@lucide/svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="view {ui.activeTab === 'ride' ? 'active' : ''} p-4">
	{#if domain.results}
		<ResultsPanel />
	{:else}
		<div class="flex flex-col items-center gap-3 px-6 py-16 text-center">
			<span class="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
				<Activity class="size-7" />
			</span>
			<h3 class="text-base font-semibold text-base-content">Nothing scored yet</h3>
			<p class="text-sm leading-relaxed text-base-content/60">Plan a route with stops, or draw one straight on the map.</p>
				<button class="btn btn-hero mt-2" type="button" onclick={() => ui.setTab('plan')}>Plan a route</button>
		</div>
	{/if}
</div>
