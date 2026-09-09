<script lang="ts">
	import { ui } from '$lib/state/ui.svelte.js';
</script>

<div class="border-t border-base-200 bg-base-200/60">
	{#if !ui.legalDismissed}
		<div class="relative p-3 pr-11 text-[0.72rem] leading-relaxed text-base-content/55">
			<strong class="text-base-content">Legal note.</strong> Electric skateboards cannot legally be ridden on public
			roads or pavements in South Africa — no registration category exists for a motorised skateboard under the
			National Road Traffic Act 93 of 1996, and pavements form part of the public road reserve. Treat this as
			planning for private property, estates, campuses and trails unless you've confirmed your own legal position.
			<button
				class="btn btn-circle btn-xs btn-ghost absolute right-2 top-2 text-base-content/40 hover:text-base-content"
				aria-label="Dismiss legal note"
				title="Dismiss"
				onclick={() => ui.dismissLegal()}
			>
				<svg viewBox="0 0 24 24" class="size-3.5 fill-current"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
			</button>
		</div>
	{:else}
		<button class="btn btn-block btn-ghost btn-sm rounded-none text-base-content/50 hover:text-primary" type="button" onclick={() => ui.restoreLegal()}>
			Show legal note
		</button>
	{/if}
</div>
