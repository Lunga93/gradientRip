<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import ModePicker from './ModePicker.svelte';
	import { tick } from 'svelte';
	import { Bolt } from '$lib/icons/index.js';

	let cardEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		if (!domain.onboardSeen) {
			tick().then(() => {
				const checked = cardEl?.querySelector<HTMLInputElement>('input[name=omode]:checked');
				if (checked) checked.focus();
			});
		}
	});

	const go = (): void => {
		domain.completeOnboarding();
		ui.setTab('plan');
	};

	const onKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') go();
	};
</script>

{#if !domain.onboardSeen}
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] backdrop-blur-sm sm:items-center"
	>
		<div
			class="card w-full max-w-md rounded-3xl border border-base-300 bg-base-100 shadow-2xl max-h-[88vh] overflow-y-auto p-6"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboardTitle"
			aria-describedby="onboardDesc"
			bind:this={cardEl}
			onkeydown={onKeydown}
			tabindex="-1"
		>
			<div class="-mx-6 -mt-6 mb-5 h-1" style="background: var(--brand-gradient)" aria-hidden="true"></div>
			<p class="text-[0.72rem] font-semibold tracking-wide text-primary">First — what are you riding?</p>
			<h2 id="onboardTitle" class="mt-1 text-xl font-bold">Pick your machine</h2>
			<p id="onboardDesc" class="mt-2 mb-4 text-[0.86rem] leading-relaxed text-base-content/60">
				Gradient tunes drag, rolling resistance, cruise speed and battery math to the vehicle class.
				You can switch anytime in the Ride settings.
			</p>
			<ModePicker variant="onboard" />
			<button type="button" class="btn btn-hero mt-5 w-full" onclick={go}>
				<Bolt class="size-4 fill-current" />
				Start planning
			</button>
		</div>
	</div>
{/if}