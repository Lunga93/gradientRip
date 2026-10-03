<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import TabBar from './TabBar.svelte';
	import { ui } from '$lib/state/ui.svelte.js';

	let { children }: { children: Snippet } = $props();

	const toastHidden = $derived(
		page.url.pathname === '/map' || page.url.pathname === '/ride'
	);
</script>

<div class="app-shell">
	<main class="app-content">
		{@render children()}
	</main>
	{#if ui.statusMsg && !toastHidden}
		<div
			class="status-toast"
			role={ui.statusErr ? 'alert' : 'status'}
			style="background: var(--surface-raised); border: 1px solid {ui.statusErr
				? 'var(--state-stop)'
				: 'var(--line)'}; border-radius: var(--radius-md); color: var(--text-primary);"
		>
			<span class="status-text">{ui.statusMsg}</span>
			<button
				type="button"
				class="status-dismiss"
				style="color: var(--text-secondary);"
				aria-label="Dismiss status message"
				onclick={() => ui.setStatus('')}
			>
				✕
			</button>
		</div>
	{/if}
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

	.status-toast {
		position: fixed;
		z-index: 50;
		right: 1rem;
		bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
		left: 1rem;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		max-width: 28rem;
		margin: 0 auto;
		padding: 0.625rem 0.625rem 0.625rem 1rem;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
	}

	.status-text {
		flex: 1 1 auto;
		min-width: 0;
		font: var(--type-body);
	}

	.status-dismiss {
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.375rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		font: var(--type-body-strong);
		cursor: pointer;
	}
</style>
