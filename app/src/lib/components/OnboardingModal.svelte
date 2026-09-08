<script lang="ts">
	import { app } from '$lib/state/app.svelte.js';
	import ModePicker from './ModePicker.svelte';
	import { tick } from 'svelte';

	let cardEl: HTMLDivElement;

	$effect(() => {
		if (!app.onboardSeen) {
			tick().then(() => {
				const checked = cardEl?.querySelector<HTMLInputElement>('input[name=omode]:checked');
				if (checked) checked.focus();
			});
		}
	});

	function go() {
		app.onboardSeen = true;
	}
</script>

{#if !app.onboardSeen}
	<div class="onboard">
		<div class="ocard" role="dialog" aria-modal="true" aria-labelledby="onboardTitle" bind:this={cardEl}>
			<p class="osection">First — what are you riding?</p>
			<h2 id="onboardTitle">Pick your machine</h2>
			<p class="osub">
				Gradient tunes drag, rolling resistance, cruise speed and battery math to the vehicle class.
				You can switch anytime under “Ride”.
			</p>
			<div class="omodes" role="radiogroup" aria-label="Transport mode">
				<ModePicker variant="onboard" />
			</div>
			<button type="button" class="go" onclick={go}>
				<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/></svg>
				Start planning
			</button>
		</div>
	</div>
{/if}
