<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { dragScroll } from '$lib/actions/dragScroll.js';
	import { MODES, MODE_ICONS } from '$lib/engine/index.js';

	let { variant = 'panel' }: { variant?: 'panel' | 'onboard' } = $props();

	const electric = Object.keys(MODES).filter((id) => MODES[id].group === 'electric');
	const human = Object.keys(MODES).filter((id) => MODES[id].group === 'human');
	const modeColor = (id: string): string => (MODES[id].group === 'electric' ? '#8b5cf6' : '#60a5fa');
</script>

{#if variant === 'panel'}
	<div
		class="drag-scroll flex gap-1.5 overflow-x-auto p-0.5 pb-1 [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden"
		role="radiogroup"
		aria-label="Transport mode"
		tabindex="0"
		use:dragScroll
	>
		{#each Object.keys(MODES) as id (id)}
			{@const picked = domain.modeId === id}
			<button
				type="button"
				role="radio"
				aria-checked={picked}
				class="mode-chip"
				class:mode-chip-picked={picked}
				style="--mc: {modeColor(id)};"
				onclick={() => domain.selectMode(id)}
			>
				{MODES[id].label}
			</button>
		{/each}
	</div>
{:else}
	<div class="flex flex-col gap-2" role="radiogroup" aria-label="Transport mode">
		{#each [{ key: 'electric', ids: electric }, { key: 'human', ids: human }] as group (group.key)}
			<div class="flex items-center gap-2">
				<span
					class="font-mono2"
					style="font-size: 0.62rem; letter-spacing: 0.12em; color: {group.key === 'electric'
						? '#8b5cf6'
						: '#60a5fa'};"
				>
					{group.key === 'electric' ? 'ELECTRIC' : 'HUMAN'}
				</span>
				<span class="h-px flex-1" style="background: var(--panel-line);"></span>
			</div>
			<div
				class="grid gap-2"
				style="grid-template-columns: repeat({group.ids.length}, 1fr);"
			>
				{#each group.ids as id (id)}
					{@const picked = domain.modeId === id}
					<button
						type="button"
						role="radio"
						aria-checked={picked}
						name="omode"
						value={id}
						class="mode-cell"
						class:mode-cell-picked={picked}
						style="--mc: {modeColor(id)}; color: {picked ? modeColor(id) : 'var(--ink-2)'};"
						onclick={() => domain.selectMode(id)}
					>
						{@html MODE_ICONS[id]}
						<span class="t">{MODES[id].label}</span>
					</button>
				{/each}
			</div>
		{/each}
	</div>
{/if}
