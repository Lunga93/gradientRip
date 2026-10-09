<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import Mark from '$lib/components/Mark.svelte';

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
	<div class="flex items-center gap-2 py-1">
		<Mark name="bookmark" cls="size-3.5 opacity-40" />
		<span class="text-base-content/70 text-[0.78rem]">
			No saved places yet — tap the bookmark icon on any stop to save it here.
		</span>
	</div>
{:else}
	{#each domain.presets as p (p.id)}
		<span class="badge badge-outline badge-lg gap-1 pr-1">
			<button
				type="button"
				class="flex min-w-0 cursor-pointer items-center gap-1.5"
				title="Use {p.label}"
				aria-label="Use saved place {p.label}"
				onclick={() => fillPreset(p.id)}
			>
				<Mark name="bookmark" cls="size-3 text-primary" />
				<span class="max-w-[10rem] truncate">{p.label}</span>
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-circle"
				title="Remove saved place"
				aria-label="Remove saved place {p.label}"
				onclick={(e) => removePreset(e, p.id)}
			>
				<Mark name="x" cls="size-3.5" />
			</button>
		</span>
	{/each}
{/if}
