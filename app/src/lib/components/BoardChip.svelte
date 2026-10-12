<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';

	let { board }: { board: { value: string; label: string } } = $props();

	const active = $derived(domain.boardVal === board.value);
</script>

<button
	type="button"
	role="radio"
	aria-checked={active}
	class="board-chip"
	class:board-chip-active={active}
	onclick={() => domain.selectBoard(board.value)}
>
	{board.label}
</button>

<style>
	.board-chip {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		padding: 0 0.75rem;
		border: none;
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		color: var(--text-secondary);
		font: var(--type-body-strong);
		cursor: pointer;
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.board-chip-active {
		background: var(--accent);
		color: var(--text-on-accent);
		box-shadow: none;
	}
	.board-chip:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
