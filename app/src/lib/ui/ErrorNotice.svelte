<script lang="ts">
	let {
		message,
		onRetry
	}: {
		message: string;
		onRetry?: () => void;
	} = $props();
</script>

<div class="error-notice" role="alert">
	<p class="error-message">{message}</p>
	{#if onRetry}
		<button type="button" class="error-retry" onclick={() => onRetry?.()}>Retry</button>
	{/if}
</div>

<style>
	.error-notice {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: var(--surface-raised);
		border: 1px solid var(--line);
		border-left: 3px solid var(--state-stop);
		border-radius: var(--radius-md);
	}

	.error-message {
		flex: 1 1 auto;
		margin: 0;
		font: var(--type-body);
		color: var(--text-primary);
	}

	.error-retry {
		flex-shrink: 0;
		padding: 0.375rem 0.875rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: var(--type-label);
		letter-spacing: 0.02em;
		cursor: pointer;
	}
</style>
