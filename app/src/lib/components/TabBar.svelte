<script lang="ts">
	import { ui } from '$lib/state/ui.svelte.js';

	const tabs = [
		{ key: 'plan', label: 'Plan' },
		{ key: 'saved', label: 'Saved' },
		{ key: 'ride', label: 'Ride' }
	] as const;
</script>

<nav
	class="flex gap-0.5 px-5 pt-2.5"
	style="border-bottom: 1px solid var(--panel-line);"
	aria-label="Main navigation"
>
	{#each tabs as tab (tab.key)}
		{@const active = ui.activeTab === tab.key}
		<button
			type="button"
			class="font-display flex-1 cursor-pointer bg-transparent pb-2"
			style="font-size: 0.9rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {active
				? 'var(--color-primary)'
				: 'var(--ink-2)'}; border: none; border-bottom: 2px solid {active
				? 'var(--color-primary)'
				: 'transparent'}; filter: {active ? 'drop-shadow(0 0 8px var(--brand-glow))' : 'none'};"
			aria-current={active ? 'page' : undefined}
			onclick={() => ui.setTab(tab.key)}
		>
			{tab.label}
		</button>
	{/each}
</nav>
