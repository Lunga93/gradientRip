<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		backHref,
		action
	}: { title: string; backHref?: string; action?: Snippet } = $props();
</script>

<header class="screen-header">
	{#if backHref}
		<a class="back" href={backHref} aria-label="Back"><span aria-hidden="true">←</span></a>
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
		min-width: 2rem;
		min-height: 2rem;
		text-decoration: none;
		font: var(--type-heading);
		color: var(--text-secondary);
	}

	.header-action {
		display: inline-flex;
		align-items: center;
	}
</style>
