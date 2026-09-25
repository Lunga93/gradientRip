<script lang="ts">
	let { lines = 3 }: { lines?: number } = $props();
</script>

<div class="skeleton" role="status" aria-label="Loading">
	{#each Array.from({ length: lines }) as _, i (i)}
		<div class="skeleton-line" aria-hidden="true"></div>
	{/each}
</div>

<style>
	.skeleton {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem 1rem;
		background: var(--surface-page);
	}

	.skeleton-line {
		height: 0.875rem;
		border-radius: var(--radius-sm);
		background: var(--line);
		animation: skeleton-pulse 1.5s ease-in-out infinite;
	}

	.skeleton-line:last-child {
		width: 60%;
	}

	@keyframes skeleton-pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
</style>
