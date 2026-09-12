<script lang="ts">
	import { ui } from '$lib/state/ui.svelte.js';
	import { social } from '$lib/social.svelte.js';

	const tabs = [
		{ key: 'plan', label: 'Plan' },
		{ key: 'saved', label: 'Saved' },
		{ key: 'ride', label: 'Ride' },
		{ key: 'friends', label: 'Friends' }
	] as const;
</script>

<nav
	class="flex gap-0.5 px-5 pt-2.5"
	style="border-bottom: 1px solid var(--panel-line);"
	aria-label="Main navigation"
>
	{#each tabs as tab (tab.key)}
		{@const active = ui.activeTab === tab.key}
		{@const badge = tab.key === 'friends' ? social.incomingCount + social.liveNow.length : 0}
		<button
			type="button"
			class="font-display relative flex-1 cursor-pointer bg-transparent py-3.5"
			style="font-size: 0.9rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: {active
				? 'var(--color-primary)'
				: 'var(--ink-1)'}; border: none; border-bottom: 2px solid {active
				? 'var(--color-primary)'
				: 'transparent'}; filter: {active ? 'drop-shadow(0 0 8px var(--brand-glow))' : 'none'};"
			aria-current={active ? 'page' : undefined}
			onclick={() => ui.setTab(tab.key)}
		>
			{tab.label}
			{#if badge > 0}
				<span
					class="font-mono2 absolute top-1.5 right-1/2 grid min-h-[20px] min-w-[20px] translate-x-7 place-items-center rounded-full px-1"
					style="font-size: 0.62rem; font-weight: 700; background: var(--color-error); color: #fff;"
					aria-label="{badge} friend updates"
				>
					{badge > 9 ? '9+' : badge}
				</span>
			{/if}
		</button>
	{/each}
</nav>
