<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import TabBar from './TabBar.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="app-shell">
	<main class="app-content">
		{@render children()}
	</main>
	{#if (page.data as { noTabs?: boolean }).noTabs !== true}
		<TabBar />
	{/if}
</div>

<style>
	.app-shell {
		display: flex;
		flex-direction: column;
		min-height: 100dvh;
		background: var(--surface-page);
		color: var(--text-primary);
		padding-bottom: env(safe-area-inset-bottom);
	}

	.app-content {
		flex: 1 1 auto;
	}
</style>
