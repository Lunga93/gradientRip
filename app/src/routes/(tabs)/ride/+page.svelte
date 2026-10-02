<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import SessionToolbar from '$lib/components/SessionToolbar.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import { domain } from '$lib/state/domain.svelte.js';
</script>

<div class="ride-page">
	<ScreenHeader title="Ride" backHref="/map" />
	<SessionToolbar />
	<div class="ride-body">
		{#if domain.results}
			<ResultsPanel />
		{:else}
			<EmptyState
				title="Nothing scored yet"
				body="Plan a route with stops, or draw one straight on the map."
				actionLabel="Plan a route"
				onAction={() => void goto(resolve('/map'))}
			/>
		{/if}
	</div>
</div>

<style>
	.ride-page {
		display: flex;
		flex-direction: column;
		height: 100dvh;
		background: var(--surface-page);
		position: relative;
	}

	/* Review fix: fixed tracking/record HUDs (z-20) overlay the header at
		390px. Keep the back link visible AND tappable by painting the header
		above them. */
	.ride-page :global(.screen-header) {
		position: relative;
		z-index: 30;
	}

	.ride-body {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding-top: 0.5rem;
	}
</style>
