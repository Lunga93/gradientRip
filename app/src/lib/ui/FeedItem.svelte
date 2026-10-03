<script lang="ts">
	import type { Snippet } from 'svelte';

	// Generic feed shell — strictly structural. Route/event/activity content
	// drops into the three slots with no change here (Phase B posts reuse
	// the body slot as-is). Action content must be 44px targets; the
	// :global affordances below enforce the floor even for raw buttons.
	let {
		header,
		body,
		actions
	}: {
		header: Snippet;
		body: Snippet;
		actions: Snippet;
	} = $props();
</script>

<article class="feed-item">
	<div class="feed-header">{@render header()}</div>
	<div class="feed-body">{@render body()}</div>
	<div class="feed-actions">{@render actions()}</div>
</article>

<style>
	.feed-item {
		background: var(--surface-raised);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.feed-header {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.75rem 1rem 0;
	}

	.feed-body {
		padding: 0.5rem 1rem 0;
		font: var(--type-body);
		color: var(--text-primary);
	}

	.feed-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.625rem;
		padding: 0.625rem 1rem 0.75rem;
		border-top: 1px solid var(--line);
	}

	.feed-actions :global(button) {
		min-height: 44px;
	}

	.feed-actions :global(a) {
		min-height: 44px;
	}

	.feed-actions :global(button:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.feed-actions :global(a:focus-visible) {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
