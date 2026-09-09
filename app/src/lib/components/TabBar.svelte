<script lang="ts">
	import { MapPin, Bookmark, Activity } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { ui } from '$lib/state/ui.svelte.js';

	interface Tab {
		key: 'plan' | 'saved' | 'ride';
		label: string;
		icon: Component;
	}
	const tabs: Tab[] = [
		{ key: 'plan', label: 'Plan', icon: MapPin },
		{ key: 'saved', label: 'Saved', icon: Bookmark },
		{ key: 'ride', label: 'Ride', icon: Activity }
	];
</script>

<nav class="flex items-stretch gap-1 border-t border-base-300 bg-base-100 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] pt-1.5" aria-label="Main navigation">
	{#each tabs as tab (tab.key)}
		<button
			class="flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[0.68rem] font-medium transition-colors {ui.activeTab === tab.key ? '' : 'text-base-content/45 hover:text-base-content'}"
			class:tab-active={ui.activeTab === tab.key}
			aria-current={ui.activeTab === tab.key ? 'page' : undefined}
			onclick={() => ui.setTab(tab.key)}
		>
			<tab.icon class="size-5" />
			{tab.label}
		</button>
	{/each}
</nav>
