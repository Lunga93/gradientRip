<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		open,
		onClose,
		children
	}: {
		open: boolean;
		onClose: () => void;
		children: Snippet;
	} = $props();
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') onClose();
	}}
/>

{#if open}
	<div
		class="sheet-backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) onClose();
		}}
	>
		<div class="sheet" role="dialog" aria-modal="true">
			<button type="button" class="sheet-close" aria-label="Close" onclick={onClose}>
				<span aria-hidden="true">×</span>
			</button>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.sheet-backdrop {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgb(15 23 42 / 0.5);
	}

	.sheet {
		width: 100%;
		max-height: 80dvh;
		overflow-y: auto;
		background: var(--surface-raised);
		color: var(--text-primary);
		border-top: 1px solid var(--line);
		border-radius: var(--radius-lg) var(--radius-lg) 0 0;
		padding: 1rem 1rem calc(1rem + env(safe-area-inset-bottom));
	}

	.sheet-close {
		display: block;
		margin-left: auto;
		min-width: 2rem;
		min-height: 2rem;
		background: transparent;
		border: none;
		border-radius: var(--radius-sm);
		font: var(--type-heading);
		color: var(--text-secondary);
		cursor: pointer;
	}
</style>
