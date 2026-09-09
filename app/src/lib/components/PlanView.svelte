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
	import { Plus, MapPin, Bolt, Edit, Circle } from '$lib/icons/index.js';

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
			<button type="button" class="action-btn flex-1" onclick={() => domain.addStop()} title="Add another stop to your route">
				<Plus />
				<span>Add stop</span>
			</button>
			<button type="button" class="action-btn flex-1" onclick={() => locateInto(domain.activeStopIndex, domain.activeStopIndex === 0)} title="Fill this stop with your current GPS location">
				<MapPin />
				<span>Use my location</span>
			</button>
		</div>

			<section class="mt-4 card p-4">
				<h2 class="mb-3 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
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

			<section class="mt-3 card p-4">
				<h2 class="mb-3 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
					Ride
					<span class="h-px flex-1 bg-base-300"></span>
				</h2>
				<ModePicker variant="panel" />
			</section>

			{#if !session.planControlsHidden}
				<section class="mt-3 card p-4">
					<h2 class="mb-3 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
						Board // Powertrain
						<span class="h-px flex-1 bg-base-300"></span>
					</h2>
						<div class="drag-scroll flex gap-2 overflow-x-auto pb-1 [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden" role="radiogroup" aria-label="Board" tabindex="0" use:dragScroll>
						{#each domain.boards as board (board.value)}
							<BoardChip {board} />
						{/each}
					</div>
						<button type="submit" class="btn btn-hero mt-3 w-full" disabled={session.planning} aria-busy={session.planning}>
						{#if session.planning}
							<span class="loading loading-spinner loading-sm"></span>
						{:else}
							<Bolt />
						{/if}
						{session.planning ? 'Planning…' : 'Plan route'}
					</button>
<div class="mt-2 flex flex-col gap-2 sm:flex-row">
					<button type="button" class="action-btn flex-1" class:btn-primary={session.drawMode} onclick={onDrawToggle}>
						<Edit />
						<span>Draw a route</span>
					</button>
					<button type="button" class="action-btn flex-1" class:btn-primary={session.recordMode} onclick={onRecordToggle}>
						<Circle />
						<span>Record live</span>
					</button>
				</div>
				</section>
				{#if ui.statusMsg || ui.statusBusy}
					<div class="mt-2 flex items-center gap-2 px-1 text-sm text-base-content/60 min-h-[1.15em]" role="status" aria-live="polite">
						{#if ui.statusBusy}<span class="loading loading-dots loading-sm flex-none text-primary shrink-0"></span>{/if}
						<span class="min-w-0 break-words whitespace-normal" class:text-error={ui.statusErr}>{ui.statusMsg}</span>
					</div>
				{/if}
			{/if}
		</div>
	</form>
</div>