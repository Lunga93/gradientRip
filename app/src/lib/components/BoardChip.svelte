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
	class:board-chip-picked={active}
	onclick={() => domain.selectBoard(board.value)}
>
	{board.label}
</button>
