<script lang="ts">
	import { Sun, Moon, Monitor } from '@lucide/svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { Bolt } from '$lib/icons/index.js';
</script>

<div class="sticky top-0 z-11 flex items-center gap-3 border-b border-base-200 bg-base-100/95 px-4 py-3 backdrop-blur-sm">
	<span class="brand-tile" aria-hidden="true">
		<Bolt class="size-5" />
	</span>
	<div class="min-w-0 flex-1 leading-tight">
		<h1 class="wordmark text-[1.15rem] font-bold tracking-tight">Gradient</h1>
		<p class="text-[0.72rem] text-base-content/55">Micromobility route lab — climb / brake / range</p>
	</div>
	<span
		class="badge badge-sm {ui.netOnline ? 'badge-ghost text-base-content/55' : 'badge-warning'} gap-1"
		title={ui.netOnline ? 'Connected' : 'Offline — saved trips still open.'}
	>
		<span class="size-1.5 rounded-full bg-current"></span>
		{ui.netOnline ? 'Online' : 'Offline'}
	</span>
	<button
		class="btn btn-circle btn-sm btn-ghost text-base-content/60 hover:text-primary"
		title={ui.theme === 'auto' ? 'Theme follows your system — tap to override' : 'Theme pinned — tap to change'}
		aria-label="Cycle theme (auto, light, dark)"
		onclick={() => ui.cycleTheme()}
	>
		{#if ui.theme === 'dark'}
			<Sun class="size-4" />
		{:else if ui.theme === 'light'}
			<Moon class="size-4" />
		{:else}
			<Monitor class="size-4" />
		{/if}
	</button>
</div>