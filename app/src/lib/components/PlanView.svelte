<script lang="ts">
	import StopList from '$lib/components/StopList.svelte';
	import BoardChip from '$lib/components/BoardChip.svelte';
	import PresetChips from '$lib/components/PresetChips.svelte';
	import HomeCircuitBar from '$lib/components/HomeCircuitBar.svelte';
	import ModePicker from '$lib/components/ModePicker.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { locateInto, runPlan } from '$lib/planner.svelte.js';
	import { readOnboardingDraft } from '$lib/profiles/onboarding.js';
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

	const boardSpec = $derived.by(() => {
		const parts = (domain.boardVal || '').split('|').map(Number);
		const cap = Number.isFinite(parts[0]) ? parts[0] : 0;
		const board = domain.boards.find((b) => b.value === domain.boardVal);
		return {
			name: board?.label ?? `Custom · ${cap} ${domain.mode.human ? 'kcal' : 'Wh'}`,
			cap,
			climb: Number.isFinite(parts[1]) ? parts[1] : 0,
			brake: Number.isFinite(parts[2]) ? parts[2] : 0
		};
	});

	const human = $derived(domain.mode.human);
</script>

	<div class="view {ui.activeTab === 'plan' ? 'active' : ''}">
	<form onsubmit={(e) => { e.preventDefault(); runPlan(); }}>
		<div class="relative p-5">
			<div class="relative">					<div class="mb-2 text-[0.7rem] font-bold tracking-[0.14em] text-base-content/60 uppercase">Route stops</div>
					<StopList />
					{#if domain.stops.every((s) => !s.value)}
						<p class="mt-1.5 text-[0.75rem] text-base-content/70">
							Type an address or place name to set your origin and destination.
						</p>
					{/if}
				<div class="mt-2.5 flex gap-2 max-[380px]:flex-col">
					<button
						type="button"
						class="btn btn-soft btn-sm flex-1 max-[380px]:w-full max-[380px]:flex-none"
						onclick={() => domain.addStop()}
						title="Add another stop to your route"
					>
						+ Add waypoint
					</button>
					<button
						type="button"
						class="btn btn-soft btn-sm max-[380px]:w-full"
						onclick={() => domain.reverseStops()}
						title="Reverse stop order"
						aria-label="Reverse stop order"
					>
						<span class="inline-flex items-center gap-1.5"><Mark name="swap" cls="size-3.5" />REV</span>
					</button>
					<button
						type="button"
						class="btn btn-soft btn-sm flex-1 max-[380px]:w-full max-[380px]:flex-none"
						onclick={() => locateInto(domain.activeStopIndex, domain.activeStopIndex === 0)}
						title="Fill this stop with your current GPS location"
					>
						<span class="inline-flex items-center gap-1.5"><Mark name="pin" cls="size-3.5" />MY LOCATION</span>
					</button>
				</div>

				<section class="mt-5">
					<div class="mb-2 text-[0.7rem] font-bold tracking-[0.14em] text-base-content/60 uppercase">Saved places</div>
					<div class="flex flex-wrap gap-1.5"><PresetChips /></div>
				</section>

				{#if !ui.netOnline}
					<div class="alert alert-warning mt-4" role="status">
						<Mark name="alert" cls="size-4 shrink-0" />
						<span class="text-[0.8rem] leading-relaxed">
							You're offline — planning a new route needs a connection, but any saved trip still opens instantly.
						</span>
					</div>
				{/if}

				<section class="mt-5">
					<div class="mb-2 text-[0.7rem] font-bold tracking-[0.14em] text-base-content/60 uppercase">Transport mode</div>
					<ModePicker variant="panel" />
				</section>

				{#if !session.planControlsHidden}
					<section class="mt-5">
						<div class="mb-2 text-[0.7rem] font-bold tracking-[0.14em] text-base-content/60 uppercase">Board // Powertrain</div>
						<div
							class="drag-scroll flex gap-1.5 overflow-x-auto pb-1 [&>*]:shrink-0 [&::-webkit-scrollbar]:hidden"
							role="radiogroup"
							aria-label="Board"
							tabindex="0"
							use:dragScroll
						>
							{#each domain.boards as board (board.value)}
								<BoardChip {board} />
							{/each}
						</div>

						<div class="card border-base-300 bg-base-100 mt-2.5 border shadow-sm">
							<div class="card-body gap-2 p-3.5">
								<div class="flex items-baseline justify-between gap-2">
									<div class="min-w-0 truncate text-[0.85rem] font-semibold">{boardSpec.name}</div>
									<div class="font-mono2 text-primary shrink-0 text-[0.62rem] font-semibold tracking-widest">
										{domain.mode.label.toUpperCase()}
									</div>
								</div>
								<div class="stats stats-horizontal w-full shadow-none">
									<div class="stat px-0">
										<div class="stat-title font-mono2 text-[0.6rem]">{human ? 'DAY BUDGET' : 'BATTERY'}</div>
										<div class="font-display stat-value text-lg">{boardSpec.cap}<span class="font-mono2 ml-1 text-[0.6rem] font-medium opacity-70">{human ? 'kcal' : 'Wh'}</span></div>
									</div>
									<div class="stat px-0">
										<div class="stat-title font-mono2 text-[0.6rem]">MAX CLIMB</div>
										<div class="font-display stat-value text-lg text-warning">{boardSpec.climb}<span class="font-mono2 ml-1 text-[0.6rem] font-medium opacity-70">%</span></div>
									</div>
									<div class="stat px-0">
										<div class="stat-title font-mono2 text-[0.6rem]">BRAKE LIM</div>
										<div class="font-display stat-value text-lg text-primary">{boardSpec.brake}<span class="font-mono2 ml-1 text-[0.6rem] font-medium opacity-70">%</span></div>
									</div>
								</div>
							</div>
						</div>

						<div class="mt-3">
							<SlashButton type="submit" label={session.planning ? 'PLANNING…' : 'PLAN ROUTE'} disabled={session.planning} style="width: 100%;" />
						</div>
						<div class="mt-2 flex gap-2">
							<button
								type="button"
								class="btn btn-sm flex-1"
								class:btn-primary={session.drawMode}
								class:btn-soft={!session.drawMode}
								onclick={onDrawToggle}
							>
								DRAW ROUTE
							</button>
							<button
								type="button"
								class="btn btn-sm flex-1"
								class:btn-error={session.recordMode}
								class:btn-soft={!session.recordMode}
								class:text-error={!session.recordMode}
								onclick={onRecordToggle}
							>
								<span class="inline-flex items-center gap-1.5"><span class="rec-dot" aria-hidden="true"></span>REC LIVE</span>
							</button>
						</div>
					</section>

					<section class="mt-5">
						<div class="sec-label">Home circuits</div>
						<!-- Null home renders nothing (null-by-design); re-read each render so a finished wizard shows up. -->
						<HomeCircuitBar home={readOnboardingDraft().home} />
					</section>

					{#if session.planning || ui.statusMsg}
						<div class="mt-3" role="status" aria-live="polite">
							{#if session.planning}
								<progress class="progress progress-primary w-full" aria-label="Planning route"></progress>
								<ul class="steps steps-vertical mt-2 w-full">
									{#each ['Geocode stops', 'Route legs', 'Fetch elevation', 'Score gradients'] as step (step)}
										<li class="step step-primary text-sm" data-content=""><span class="text-left">{step}</span></li>
									{/each}
								</ul>
							{:else if ui.statusErr}
								<div class="alert alert-error">
									<Mark name="alert" cls="size-4 shrink-0" />
									<div class="min-w-0">
										<p class="m-0 text-[0.82rem] leading-relaxed">{ui.statusMsg}</p>
										<button type="button" class="btn btn-error btn-xs mt-2" onclick={() => runPlan()}>
											↺ RETRY
										</button>
									</div>
								</div>
							{:else}
								<p class="m-0 px-1 text-sm text-base-content/70">{ui.statusMsg}</p>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</form>
</div>
