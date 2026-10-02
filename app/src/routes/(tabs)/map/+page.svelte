<script lang="ts">
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import MapFabs from '$lib/components/MapFabs.svelte';
	import SessionToolbar from '$lib/components/SessionToolbar.svelte';
	import PlanView from '$lib/components/PlanView.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import HomeCircuitBar from '$lib/components/HomeCircuitBar.svelte';
	import { renderFriendMarkers, clearFriendMarkers } from '$lib/mapController.svelte.js';
	import { social, friendName } from '$lib/social.svelte.js';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { readOnboardingDraft } from '$lib/profiles/onboarding.js';

	// Mirror live buddies onto the map (cleared when nobody is live).
	$effect(() => {
		const pins = social.livePeers.map((p) => ({
			id: p.id,
			name: friendName(p),
			avatar: p.avatar_url ?? '',
			lat: p.lat,
			lon: p.lon,
			stale: p.freshness !== 'live'
		}));
		if (pins.length > 0) renderFriendMarkers(pins);
		else clearFriendMarkers();
		return () => clearFriendMarkers();
	});
</script>

<MapCanvas />
<MapFabs />
<SessionToolbar />
<section class="map-sheet" aria-label="Route planner">
	<PlanView />
	{#if !session.planControlsHidden}
		<section class="home-circuits">
			<div class="sheet-label">Home circuits</div>
			<!-- Null home renders nothing (null-by-design); re-read each render so a finished wizard shows up. -->
			<HomeCircuitBar home={readOnboardingDraft().home} />
		</section>
	{/if}
	{#if domain.results}
		<ResultsPanel />
	{/if}
</section>

<style>
	.map-sheet {
		position: fixed;
		z-index: 10;
		right: 0;
		bottom: 0;
		left: 0;
		max-height: 62dvh;
		overflow-y: auto;
		background: var(--surface-page);
		border-top: 1px solid var(--line);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
	}

	@media (min-width: 768px) {
		.map-sheet {
			top: 1rem;
			right: auto;
			bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
			left: 1rem;
			width: 400px;
			max-height: none;
			border: 1px solid var(--line);
			border-radius: var(--radius-lg);
		}
	}

	.home-circuits {
		margin-top: 1.25rem;
		padding: 0 1.25rem 1.25rem;
	}

	.sheet-label {
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
		margin-bottom: 0.625rem;
	}
</style>
