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

<nav class="tabs tabs-border px-5 pt-2.5" aria-label="Main navigation">
	{#each tabs as tab (tab.key)}
		{@const active = ui.activeTab === tab.key}
		{@const badge = tab.key === 'friends' ? social.incomingCount + social.liveNow.length : 0}
		<button
			type="button"
			class="tab font-display flex-1 uppercase"
			class:tab-active={active}
			aria-current={active ? 'page' : undefined}
			onclick={() => ui.setTab(tab.key)}
		>
			{tab.label}
			{#if badge > 0}
				<span class="badge badge-error badge-xs" aria-label="{badge} friend updates">
					{badge > 9 ? '9+' : badge}
				</span>
			{/if}
		</button>
	{/each}
</nav>
