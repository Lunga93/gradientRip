<script lang="ts">
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="view {ui.activeTab === 'ride' ? 'active' : ''} p-5">
	{#if domain.results}
		<div class="-m-5">
			<ResultsPanel />
		</div>
	{:else}
		<div class="flex flex-col items-center gap-3 px-6 py-16 text-center">
			<svg width="80" height="50" viewBox="0 0 80 50" fill="none" aria-hidden="true">
				<path
					d="M8 44 Q 16 36 24 28 Q 36 18 48 12 Q 60 6 72 4"
					stroke="var(--ink-3)"
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-dasharray="5 4"
				/>
				<circle cx="8" cy="44" r="5" stroke="var(--ink-3)" stroke-width="2" fill="none" />
				<circle cx="72" cy="4" r="5" stroke="var(--ink-3)" stroke-width="2" fill="none" />
			</svg>
			<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">Nothing scored yet</h3>
			<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
				Plan a route with stops, or draw one straight on the map.
			</p>
			<SlashButton label="Plan a route" size="sm" onclick={() => ui.setTab('plan')} />
		</div>
	{/if}
</div>
