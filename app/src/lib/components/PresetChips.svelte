<script lang="ts">
	import { app } from '$lib/state/app.svelte.js';

	function fillPreset(id: number) {
		const p = app.presets.find((x) => x.id === id);
		if (!p) return;
		app.applyPresetToActiveStop(p);
	}

	function removePreset(e: MouseEvent, id: number) {
		e.stopPropagation();
		app.deletePreset(id);
	}
</script>

{#if !app.presets.length}
	<span class="status" style="margin:0;">No saved places yet — tap ★ on a stop to save it.</span>
{:else}
	{#each app.presets as p (p.id)}
		<span class="preset-chip" role="button" tabindex="0"
			onclick={() => fillPreset(p.id)}
			onkeydown={(e) => e.key === 'Enter' && fillPreset(p.id)}>
			<svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
			{p.label}
			<span class="del" title="Remove saved place" onclick={(e) => removePreset(e, p.id)}>&times;</span>
		</span>
	{/each}
{/if}
