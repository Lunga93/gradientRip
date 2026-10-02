<script lang="ts">
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import SavedTrips from '$lib/components/SavedTrips.svelte';
</script>

<ScreenHeader title="My rides" backHref="/me" />
<div class="rides-body">
	<p class="rides-sub">Open offline — no connection needed.</p>
	<SavedTrips />
</div>

<style>
	.rides-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.rides-sub {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}
</style>
