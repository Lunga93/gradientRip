<script lang="ts">
	import { app } from '$lib/state/app.svelte.js';
	import { MODES, MODE_ICONS } from '$lib/modes.js';

	export let variant: 'panel' | 'onboard' = 'panel';

	const ids = Object.keys(MODES);

	function pick(id: string) {
		app.selectMode(id);
	}
</script>

{#if variant === 'panel'}
	{#each ids as id (id)}
		<span class="tmode">
			<input
				type="radio"
				name="tmode"
				id="tm-{id}"
				value={id}
				checked={app.modeId === id}
				onchange={() => pick(id)}
			/>
			<label for="tm-{id}">
				{@html MODE_ICONS[id]}
				{MODES[id].label.split(' ')[0]}
			</label>
		</span>
	{/each}
{:else}
	{#each ['electric', 'human'] as group, gi (group)}
		<p class="ogroup" class:first={gi === 0}>{group === 'electric' ? 'Electric' : 'Human-powered'}</p>
		{#each ids.filter((id) => MODES[id].group === group) as id (id)}
			<span class="omode">
				<input
					type="radio"
					name="omode"
					id="om-{id}"
					value={id}
					checked={app.modeId === id}
					onchange={() => pick(id)}
				/>
				<label for="om-{id}">
					{@html MODE_ICONS[id]}
					<strong>{MODES[id].label}</strong>
					<span>{MODES[id].tag}</span>
				</label>
			</span>
		{/each}
	{/each}
{/if}
