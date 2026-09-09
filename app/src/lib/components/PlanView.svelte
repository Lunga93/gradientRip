<script lang="ts">
	import StopList from '$lib/components/StopList.svelte';
	import BoardChip from '$lib/components/BoardChip.svelte';
	import PresetChips from '$lib/components/PresetChips.svelte';
	import ModePicker from '$lib/components/ModePicker.svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { locateInto, runPlan } from '$lib/planner.svelte.js';
	import { enterDrawMode, exitDrawMode, enterRecordMode, exitRecordMode } from '$lib/tracker.js';
	import { dragScroll } from '$lib/actions/dragScroll.js';

	const onDrawToggle = (): void => {
		if (session.drawMode) exitDrawMode();
		else enterDrawMode();
	};
	const onRecordToggle = (): void => {
		if (session.recordMode) exitRecordMode();
		else enterRecordMode();
	};
</script>

<div class="view {ui.activeTab === 'plan' ? 'active' : ''}">
	<form onsubmit={(e) => { e.preventDefault(); runPlan(); }}>
		<div class="p-4">
			<StopList />
			<div class="stops-actions mt-2.5 flex gap-2">
				<button type="button" class="btn btn-outline btn-sm flex-1" onclick={() => domain.addStop()}>
					<svg viewBox="0 0 24 24" class="size-4 fill-current"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
					Add stop
				</button>
				<button type="button" class="btn btn-outline btn-sm flex-1 text-primary" onclick={() => locateInto(domain.activeStopIndex, domain.activeStopIndex === 0)}>
					<svg viewBox="0 0 24 24" class="size-4 fill-current"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9-1h-2.06A7.002 7.002 0 0013 1.06V-1h-2v2.06A7.002 7.002 0 003.06 8H1v2h2.06A7.002 7.002 0 0011 16.94V19h2v-2.06A7.002 7.002 0 0019.94 10H21V8zm-9 8a5 5 0 110-10 5 5 0 010 10z" /></svg>
					Use my location
				</button>
			</div>

			<section class="mt-4 rounded-2xl border border-base-200 bg-base-100 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
				<h2 class="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
					Saved places
					<span class="h-px flex-1 bg-base-300"></span>
				</h2>
				<div class="flex flex-wrap gap-2"><PresetChips /></div>
			</section>

			{#if !ui.netOnline}
				<div class="alert alert-warning mt-3 py-2 text-[0.8rem] shadow-none">
					<span>You're offline — planning a new route needs a connection, but any saved trip still opens instantly. Routing stays biased to your last known location until you're back online.</span>
				</div>
			{/if}

			<section class="mt-3 rounded-2xl border border-base-200 bg-base-100 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
				<h2 class="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
					Ride
					<span class="h-px flex-1 bg-base-300"></span>
				</h2>
				<ModePicker variant="panel" />
			</section>

			{#if !session.planControlsHidden}
				<section class="mt-3 rounded-2xl border border-base-200 bg-base-100 p-3 shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
					<h2 class="mb-2 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
						Board // Powertrain
						<span class="h-px flex-1 bg-base-300"></span>
					</h2>
						<div class="drag-scroll gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Board" tabindex="0" use:dragScroll>
						{#each domain.boards as board (board.value)}
							<BoardChip {board} />
						{/each}
					</div>
						<button type="submit" class="btn btn-hero mt-3 w-full" disabled={session.planning} aria-busy={session.planning}>
						{#if session.planning}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<svg viewBox="0 0 24 24" class="size-4 fill-current"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" /></svg>
						{/if}
						{session.planning ? 'Planning…' : 'Plan route'}
					</button>
					<div class="mt-2 flex flex-col gap-2 sm:flex-row">
						<button type="button" class="btn btn-outline btn-sm flex-1" class:btn-primary={session.drawMode} onclick={onDrawToggle}>
							<svg viewBox="0 0 24 24" class="size-4 fill-current"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" /></svg>
							Draw a route
						</button>
						<button type="button" class="btn btn-outline btn-sm flex-1" class:btn-primary={session.recordMode} onclick={onRecordToggle}>
							<svg viewBox="0 0 24 24" class="size-4 fill-current"><circle cx="12" cy="12" r="7" /></svg>
							Record live
						</button>
					</div>
				</section>
				<div class="status {ui.statusErr ? 'err' : ''} flex min-h-[1.15em] items-center gap-2 px-1 text-base-content/60" role="status" aria-live="polite">
					{#if ui.statusBusy}<span class="loading loading-dots loading-sm text-primary"></span>{/if}
					{ui.statusMsg}
				</div>
			{/if}
		</div>
	</form>
</div>
