<script lang="ts">
	import { ui } from '$lib/state/ui.svelte.js';
	import Mark from '$lib/components/Mark.svelte';
</script>

<div class="border-base-300 border-t">
	{#if !ui.legalDismissed}
		<div class="alert rounded-none text-[0.72rem] leading-relaxed">
			<span><strong>Legal note.</strong> Electric skateboards cannot legally be ridden on public
			roads or pavements in South Africa — no registration category exists for a motorised skateboard under the
			National Road Traffic Act 93 of 1996, and pavements form part of the public road reserve. Treat this as
			planning for private property, estates, campuses and trails unless you've confirmed your own legal position.</span>
			<button
				class="btn btn-ghost btn-xs btn-circle shrink-0"
				aria-label="Dismiss legal note"
				title="Dismiss"
				onclick={() => ui.dismissLegal()}
			>
				<Mark name="x" cls="size-4" />
			</button>
		</div>
	{:else}
		<button
			class="font-mono2 btn btn-ghost btn-sm w-full text-[0.65rem] tracking-widest"
			type="button"
			onclick={() => ui.restoreLegal()}
		>
			SHOW LEGAL NOTE
		</button>
	{/if}
</div>
