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

{#if session.acIdx === stopIndex && domain.presets.length > 0}
	<div class="address-focus absolute top-full right-0 left-0 z-20 mt-1.5 overflow-hidden" style="background: var(--panel-bg); box-shadow: inset 0 0 0 1px var(--panel-line), 0 12px 32px rgba(0,0,0,0.35); border-radius: 10px;">
		<div class="font-mono2 px-3 py-2 text-xs font-semibold tracking-wide uppercase" style="color: var(--ink-2);">Saved places</div>
		<div>
			{#each domain.presets as p (p.id)}
				<button
					type="button"
					class="addr-item flex w-full cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors"
					style="background: transparent; border: none; border-top: 1px solid var(--panel-line);"
					onclick={() => fillPreset(p)}
				>
					<Mark name="pin" cls="size-4 shrink-0 text-primary" />
					<span class="min-w-0 flex-1 truncate text-sm text-base-content">{p.label}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}
