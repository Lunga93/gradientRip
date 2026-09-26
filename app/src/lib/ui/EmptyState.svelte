<script lang="ts">
	let {
		title,
		body,
		actionLabel,
		onAction
	}: {
		title: string;
		body: string;
		actionLabel?: string;
		onAction?: () => void;
	} = $props();
</script>

<section class="empty-state">
	<h2 class="empty-title">{title}</h2>
	<p class="empty-body">{body}</p>
	{#if actionLabel && onAction}
		<button type="button" class="empty-action" onclick={() => onAction?.()}>
			{actionLabel}
		</button>
	{/if}
</section>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		text-align: center;
		padding: 2.5rem 1.5rem;
		background: var(--surface-page);
	}

	.empty-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.empty-body {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.empty-action {
		margin-top: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.625rem 1.25rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		background: var(--accent);
		color: var(--text-on-accent);
		font: var(--type-body-strong);
		cursor: pointer;
	}

	.empty-action:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
