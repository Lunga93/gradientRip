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
	<span class="text-[0.78rem]" style="color: var(--ink-2);"
		>No saved places yet — tap the bookmark on a stop to save it.</span
	>
{:else}
	{#each domain.presets as p (p.id)}
		<span class="preset-chip">
			<button
				type="button"
				class="flex min-w-0 cursor-pointer items-center gap-1.5 bg-transparent"
				style="border: none; color: inherit;"
				title="Use {p.label}"
				aria-label="Use saved place {p.label}"
				onclick={() => fillPreset(p.id)}
			>
				<Mark name="bookmark" cls="size-3 text-primary" />
				<span class="max-w-[10rem] truncate">{p.label}</span>
			</button>
			<button
				type="button"
				class="grid size-8 cursor-pointer place-items-center text-base-content/50 transition-colors hover:text-error"
				style="background: transparent; border: none;"
				title="Remove saved place"
				aria-label="Remove saved place {p.label}"
				onclick={(e) => removePreset(e, p.id)}
			>
				<Mark name="x" cls="size-3.5" />
			</button>
		</span>
	{/each}
{/if}
