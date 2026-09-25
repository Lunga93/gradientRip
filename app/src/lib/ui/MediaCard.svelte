<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		meta,
		media,
		footer
	}: {
		title: string;
		meta?: string;
		media?: Snippet;
		footer?: Snippet;
	} = $props();
</script>

<article class="media-card">
	{#if media}
		<div class="card-media">{@render media()}</div>
	{/if}
	<div class="card-body">
		<h3 class="card-title">{title}</h3>
		{#if meta}
			<p class="card-meta">{meta}</p>
		{/if}
	</div>
	{#if footer}
		<div class="card-footer">{@render footer()}</div>
	{/if}
</article>

<style>
	.media-card {
		background: var(--surface-raised);
		border: 1px solid var(--line);
		border-radius: var(--radius-lg);
		box-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
		overflow: hidden;
	}

	.card-media {
		border-bottom: 1px solid var(--line);
	}

	.card-body {
		padding: 0.75rem 1rem;
	}

	.card-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.card-meta {
		margin: 0.25rem 0 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.card-footer {
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--line);
	}
</style>
