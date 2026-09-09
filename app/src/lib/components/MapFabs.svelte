<script lang="ts">
	import { MapPin, Crosshair } from '@lucide/svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { locateInto } from '$lib/planner.svelte.js';
	import { recenter } from '$lib/tracker.js';
	import { ensureMap } from '$lib/mapController.svelte.js';

	const locateFab = (): void => {
		ensureMap();
		locateInto(0, true);
	};
</script>

<!-- hidden while the mobile sheet is open so they don't cover it -->
{#if !(ui.isMobile && ui.sheetOpen)}
<button
	class="btn btn-circle btn-lg fixed z-30 border border-base-300 bg-base-100 text-base-content/70 shadow-xl hover:text-primary right-3 bottom-[calc(196px+env(safe-area-inset-bottom,0px))] md:left-auto md:right-4 md:bottom-4"
	aria-label="Use my location"
	title="Use my location"
	onclick={locateFab}
>
	<MapPin class="size-5" />
</button>
{/if}
{#if session.recenterVisible && !(ui.isMobile && ui.sheetOpen)}
	<button
		class="btn btn-circle btn-lg fixed z-30 border border-base-300 bg-base-100 text-base-content/70 shadow-xl hover:text-primary right-3 bottom-[calc(252px+env(safe-area-inset-bottom,0px))] md:left-auto md:right-4 md:bottom-[4.5rem]"
		aria-label="Re-center on live position"
		title="Re-center"
		onclick={() => recenter()}
	>
		<Crosshair class="size-5" />
	</button>
{/if}