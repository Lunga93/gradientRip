<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div
	class="sticky top-0 z-11 flex items-center justify-between gap-3 px-5 py-4"
	style="border-bottom: 1px solid var(--panel-line);"
>
	<span class="font-display" style="font-weight: 700; font-size: 1.35rem; letter-spacing: -0.01em;">
		<span class="wordmark">GradientRip</span>
	</span>
	<div class="flex items-center gap-2">
		<span
			class="net-badge"
			style="color: {ui.netOnline ? 'var(--v-go)' : 'var(--v-caution)'}; background: color-mix(in srgb, currentcolor 12%, transparent);"
			title={ui.netOnline ? 'Connected' : 'Offline — saved trips still open.'}
		>
			<i aria-hidden="true"></i>
			{ui.netOnline ? 'ONLINE' : 'OFFLINE'}
		</span>
		<button
			type="button"
			class="grid size-11 cursor-pointer place-items-center"
			style="background: var(--panel-soft); box-shadow: inset 0 0 0 1px var(--panel-line); border-radius: 6px; color: var(--color-primary);"
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
