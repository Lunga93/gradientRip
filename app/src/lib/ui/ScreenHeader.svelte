<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		title,
		backHref,
		action
	}: { title: string; backHref?: string; action?: Snippet } = $props();
</script>

<header class="screen-header">
	{#if backHref}
		<a class="back" href={resolve(backHref as '/home')} aria-label="Back"><span aria-hidden="true">←</span></a>
	{/if}
	<h1 class="title">{title}</h1>
	{#if action}
		<div class="header-action">{@render action()}</div>
	{/if}
</header>

<style>
	.screen-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-page);
		border-bottom: 1px solid var(--line);
	}

	.title {
		flex: 1 1 auto;
		margin: 0;
		font: var(--type-title);
		color: var(--text-primary);
	}

	.back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		text-decoration: none;
		font: var(--type-heading);
		color: var(--text-secondary);
	}

	.back:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.header-action {
		display: inline-flex;
		align-items: center;
	}
</style>
