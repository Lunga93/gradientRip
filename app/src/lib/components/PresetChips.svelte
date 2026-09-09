<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { Bookmark } from '$lib/icons/index.js';

	const fillPreset = (id: number): void => {
		const p = domain.presets.find((x) => x.id === id);
		if (!p) return;
		domain.applyPresetToActiveStop(p);
	};

	const removePreset = (e: MouseEvent, id: number): void => {
		e.stopPropagation();
		domain.deletePreset(id);
	};
</script>

{#if !domain.presets.length}
	<span class="text-[0.78rem] text-base-content/60">No saved places yet — tap the star on a stop to save it.</span>
{:else}
	{#each domain.presets as p (p.id)}
		<span
			class="pill gap-1.5 px-3 py-3"
		>
			<button
				type="button"
				class="flex min-w-0 cursor-pointer items-center gap-1.5 bg-transparent"
				title="Use {p.label}"
				aria-label="Use saved place {p.label}"
				onclick={() => fillPreset(p.id)}
			>
				<Bookmark class="size-3 fill-primary" />
				<span class="max-w-[10rem] truncate">{p.label}</span>
			</button>
			<button
				type="button"
				class="btn btn-circle btn-xs btn-ghost -mr-1 text-base-content/50 hover:bg-error/15 hover:text-error"
				title="Remove saved place"
				aria-label="Remove saved place {p.label}"
				onclick={(e) => removePreset(e, p.id)}
			>&times;</button>
		</span>
	{/each}
{/if}