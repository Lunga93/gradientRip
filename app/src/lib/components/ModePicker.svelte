<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { dragScroll } from '$lib/actions/dragScroll.js';
	import { MODES, MODE_ICONS } from '$lib/engine/index.js';

	let { variant = 'panel' }: { variant?: 'panel' | 'onboard' } = $props();

	const electric = Object.keys(MODES).filter((id) => MODES[id].group === 'electric');
	const human = Object.keys(MODES).filter((id) => MODES[id].group === 'human');
</script>

{#if variant === 'panel'}
	<div
		class="drag-scroll flex gap-2 overflow-x-auto p-0.5 pb-3 [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden"
		role="radiogroup"
		aria-label="Transport mode"
		tabindex="0"
		use:dragScroll
	>
		{#each Object.keys(MODES) as id (id)}
			<label class="cursor-pointer select-none">
				<input
					type="radio"
					name="tmode"
					value={id}
					class="peer sr-only"
					checked={domain.modeId === id}
					onchange={() => domain.selectMode(id)}
				/>
				<span
					class="mode-pick flex min-w-[76px] flex-col items-center gap-2 rounded-2xl border border-base-300 bg-base-200 px-2 py-3 text-[0.7rem] font-semibold text-base-content/70 transition-all hover:border-primary/60 active:scale-95"
				>
					{@html MODE_ICONS[id]}
					{MODES[id].label.split(' ')[0]}
				</span>
			</label>
		{/each}
	</div>
{:else}
	<div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Transport mode">
		{#each [{ key: 'electric', label: 'Electric' }, { key: 'human', label: 'Human-powered' }] as group (group.key)}
			<p class="col-span-2 mt-2 text-[0.72rem] font-semibold tracking-wide text-primary first:mt-0">{group.label}</p>
			{#each (group.key === 'electric' ? electric : human) as id (id)}
				<label class="cursor-pointer">
					<input
						type="radio"
						name="omode"
						value={id}
						class="peer sr-only"
						checked={domain.modeId === id}
						onchange={() => domain.selectMode(id)}
					/>
					<span
						class="mode-pick block rounded-2xl border border-base-300 bg-base-200 p-3 transition-colors hover:border-primary/60"
					>
						{@html MODE_ICONS[id]}
						<strong class="mt-1.5 block text-[0.92rem]">{MODES[id].label}</strong>
						<span class="mt-0.5 block text-[0.74rem] leading-snug text-base-content/60">{MODES[id].tag}</span>
					</span>
				</label>
			{/each}
		{/each}
	</div>
{/if}