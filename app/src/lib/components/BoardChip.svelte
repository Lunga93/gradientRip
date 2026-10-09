<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';

	let { board }: { board: { value: string; label: string } } = $props();

	const active = $derived(domain.boardVal === board.value);
</script>

<button
	type="button"
	role="radio"
	aria-checked={active}
	class="btn btn-sm flex-1"
	class:btn-active={active}
	class:btn-primary={active}
	class:btn-soft={!active}
	onclick={() => domain.selectBoard(board.value)}
>
	{board.label}
</button>
