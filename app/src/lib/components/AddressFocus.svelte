<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { DestinationPin } from '$lib/icons/index.js';

	interface Props {
		stopIndex: number;
	}

	let { stopIndex }: Props = $props();

	const fillPreset = (p: { id: number; label: string; query: string; coords: [number, number] | null }): void => {
		domain.applyPresetToActiveStop(p);
	};
</script>

{#if session.acIdx === stopIndex && domain.presets.length > 0}
	<div class="address-focus absolute top-full left-0 right-0 mt-1.5 z-20 card overflow-hidden">
		<div class="px-3 py-2 text-xs font-semibold text-base-content/50 uppercase tracking-wide">Saved places</div>
		<div class="divide-y divide-base-200">
			{#each domain.presets as p (p.id)}
				<button
					type="button"
					class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-base-200 transition-colors"
					onclick={() => fillPreset(p)}
				>
					<DestinationPin class="size-4 shrink-0 text-primary" />
					<span class="flex-1 min-w-0 truncate text-sm text-base-content">{p.label}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}