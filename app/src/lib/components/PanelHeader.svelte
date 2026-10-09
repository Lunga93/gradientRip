<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="border-base-300 sticky top-0 z-11 flex items-center justify-between gap-3 border-b px-5 py-4">
	<span class="font-display text-[1.35rem] font-bold tracking-tight">
		<span class="wordmark">GradientRip</span>
	</span>
	<div class="flex items-center gap-2">
		<span
			class="badge badge-soft"
			class:badge-success={ui.netOnline}
			class:badge-warning={!ui.netOnline}
			title={ui.netOnline ? 'Connected' : 'Offline — saved trips still open.'}
		>
			{ui.netOnline ? 'ONLINE' : 'OFFLINE'}
		</span>
		<button
			type="button"
			class="btn btn-square btn-soft btn-primary btn-sm"
			title={ui.theme === 'auto'
				? 'Theme follows your system — tap to override'
				: 'Theme pinned — tap to change'}
			aria-label="Cycle theme (auto, light, dark)"
			onclick={() => ui.cycleTheme()}
		>
			{#if ui.theme === 'dark'}
				<Mark name="sun" cls="size-4" />
			{:else if ui.theme === 'light'}
				<Mark name="moon" cls="size-4" />
			{:else}
				<Mark name="monitor" cls="size-4" />
			{/if}
		</button>
	</div>
</div>
