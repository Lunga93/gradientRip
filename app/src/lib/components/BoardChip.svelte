<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';

	let { board }: { board: { value: string; label: string } } = $props();

	const active = $derived((domain.boardVal || domain.boards[0]?.value) === board.value);
</script>

<button
	type="button"
	role="radio"
	aria-checked={active}
	class:pick-active={active}
	class="btn btn-sm btn-soft border border-base-300 whitespace-nowrap"
	onclick={() => domain.selectBoard(board.value)}
>
	{board.label}
</button>