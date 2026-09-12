<script lang="ts">
	import { ui } from '$lib/state/ui.svelte.js';
	import Mark from '$lib/components/Mark.svelte';
</script>

<div style="border-top: 1px solid var(--panel-line); background: var(--panel-soft);">
	{#if !ui.legalDismissed}
		<div class="relative p-3 pr-11 text-[0.72rem] leading-relaxed" style="color: var(--ink-2);">
			<strong style="color: var(--ink-0);">Legal note.</strong> Electric skateboards cannot legally be ridden on public
			roads or pavements in South Africa — no registration category exists for a motorised skateboard under the
			National Road Traffic Act 93 of 1996, and pavements form part of the public road reserve. Treat this as
			planning for private property, estates, campuses and trails unless you've confirmed your own legal position.
			<button
				class="absolute top-0 right-0 grid size-11 cursor-pointer place-items-center"
				style="background: transparent; border: none; color: var(--ink-2);"
				aria-label="Dismiss legal note"
				title="Dismiss"
				onclick={() => ui.dismissLegal()}
			>
				<Mark name="x" cls="size-4" />
			</button>
		</div>
	{:else}
		<button
			class="font-mono2 w-full cursor-pointer py-2 text-[0.65rem] tracking-widest"
			style="background: transparent; border: none; color: var(--ink-2); min-height: 44px;"
			type="button"
			onclick={() => ui.restoreLegal()}
		>
			SHOW LEGAL NOTE
		</button>
	{/if}
</div>
