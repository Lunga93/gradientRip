<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	let {
		title,
		meta,
		avatar,
		trailing,
		href
	}: {
		title: string;
		meta?: string;
		avatar?: Snippet;
		trailing?: Snippet;
		href?: string;
	} = $props();
</script>

{#snippet rowInner()}
	{#if avatar}
		<span class="row-avatar">{@render avatar()}</span>
	{/if}
	<span class="row-body">
		<span class="row-title">{title}</span>
		{#if meta}
			<span class="row-meta">{meta}</span>
		{/if}
	</span>
	{#if trailing}
		<span class="row-trailing">{@render trailing()}</span>
	{/if}
{/snippet}

{#if href}
	<a class="list-row" href={resolve(href as '/home')}>{@render rowInner()}</a>
{:else}
	<div class="list-row">{@render rowInner()}</div>
{/if}

<style>
	.list-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-page);
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--line);
	}

	.row-avatar {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
	}

	.row-body {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.row-title {
		font: var(--type-body-strong);
		color: var(--text-primary);
	}

	.row-meta {
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.row-trailing {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
	}
</style>
