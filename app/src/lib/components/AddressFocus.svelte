<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import Mark from '$lib/components/Mark.svelte';

	interface Props {
		stopIndex: number;
	}

	let { stopIndex }: Props = $props();

	const fillPreset = (p: { id: number; label: string; query: string; coords: [number, number] | null }): void => {
		domain.applyPresetToActiveStop(p);
	};
</script>

{#if session.acIdx === stopIndex && domain.presets.length > 0 && session.acResults.length === 0}
	<div class="card bg-base-100 absolute top-full right-0 left-0 z-20 mt-1.5 shadow-xl">
		<div class="font-mono2 text-base-content/70 px-3 py-2 text-xs font-semibold tracking-wide uppercase">Saved places</div>
		<ul class="menu w-full p-1">
			{#each domain.presets as p (p.id)}
				<li>
					<button type="button" onclick={() => fillPreset(p)}>
						<Mark name="pin" cls="size-4 shrink-0 text-primary" />
						<span class="min-w-0 flex-1 truncate text-sm">{p.label}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}
