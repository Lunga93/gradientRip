<script lang="ts">
	import StopList from '$lib/components/StopList.svelte';
	import BoardChip from '$lib/components/BoardChip.svelte';
	import PresetChips from '$lib/components/PresetChips.svelte';
	import ModePicker from '$lib/components/ModePicker.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import RouteMotif from '$lib/components/RouteMotif.svelte';
	import Mark from '$lib/components/Mark.svelte';
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
			<RouteMotif opacity={0.1} />
			<div class="relative">
				<div class="sec-label">Route stops</div>
				<StopList />
				<div class="stops-actions mt-2.5 flex gap-2">
					<button
						type="button"
						class="board-chip flex-1"
						onclick={() => domain.addStop()}
						title="Add another stop to your route"
					>
						+ Add waypoint
					</button>
					<button
						type="button"
						class="board-chip"
						onclick={() => domain.reverseStops()}
						title="Reverse stop order"
						aria-label="Reverse stop order"
					>
						<span class="inline-flex items-center gap-1.5"><Mark name="swap" cls="size-3.5" />REV</span>
					</button>
					<button
						type="button"
						class="board-chip flex-1"
						onclick={() => locateInto(domain.activeStopIndex, domain.activeStopIndex === 0)}
						title="Fill this stop with your current GPS location"
					>
						<span class="inline-flex items-center gap-1.5"><Mark name="pin" cls="size-3.5" />MY LOCATION</span>
					</button>
				</div>

				<section class="mt-5">
					<div class="sec-label">Saved places</div>
					<div class="flex flex-wrap gap-1.5"><PresetChips /></div>
				</section>

				{#if !ui.netOnline}
					<div class="mt-4 flex items-start gap-2.5 p-3" style="background: color-mix(in srgb, var(--v-caution) 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v-caution) 35%, transparent); border-radius: 8px;" role="status">
						<Mark name="alert" cls="size-4 mt-0.5 shrink-0" />
						<span class="text-[0.8rem] leading-relaxed" style="color: var(--ink-1);">
							You're offline — planning a new route needs a connection, but any saved trip still opens instantly.
						</span>
					</div>
				{/if}

				<section class="mt-5">
					<div class="sec-label">Transport mode</div>
					<ModePicker variant="panel" />
				</section>

				{#if !session.planControlsHidden}
					<section class="mt-5">
						<div class="sec-label">Board // Powertrain</div>
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

						<div class="chamfer-card mt-2.5 p-3.5">
							<div class="flex items-baseline justify-between gap-2">
								<div class="min-w-0 truncate text-[0.85rem] font-semibold text-base-content">{boardSpec.name}</div>
								<div class="font-mono2 shrink-0 text-[0.62rem] font-semibold tracking-widest" style="color: var(--color-primary);">
									{domain.mode.label.toUpperCase()}
								</div>
							</div>
							<div class="mt-2.5 grid grid-cols-3 gap-2">
								<div>
									<div class="font-mono2 text-[0.6rem] tracking-widest" style="color: var(--ink-2);">{human ? 'DAY BUDGET' : 'BATTERY'}</div>
									<div class="font-display text-lg font-bold" style="color: var(--ink-0);">{boardSpec.cap}<small class="font-mono2 ml-1 text-[0.6rem] font-medium" style="color: var(--ink-2);">{human ? 'kcal' : 'Wh'}</small></div>
								</div>
								<div>
									<div class="font-mono2 text-[0.6rem] tracking-widest" style="color: var(--ink-2);">MAX CLIMB</div>
									<div class="font-display text-lg font-bold" style="color: var(--v-caution);">{boardSpec.climb}<small class="font-mono2 ml-1 text-[0.6rem] font-medium" style="color: var(--ink-2);">%</small></div>
								</div>
								<div>
									<div class="font-mono2 text-[0.6rem] tracking-widest" style="color: var(--ink-2);">BRAKE LIM</div>
									<div class="font-display text-lg font-bold" style="color: var(--color-primary);">{boardSpec.brake}<small class="font-mono2 ml-1 text-[0.6rem] font-medium" style="color: var(--ink-2);">%</small></div>
								</div>
							</div>
						</div>

						<div class="mt-3">
							<SlashButton type="submit" label={session.planning ? 'PLANNING…' : 'PLAN ROUTE'} disabled={session.planning} style="width: 100%;" />
						</div>
						<div class="mt-2 flex gap-2">
							<button
								type="button"
								class="board-chip flex-1"
								style={session.drawMode ? 'background: color-mix(in srgb, var(--color-primary) 24%, transparent); color: var(--color-primary); box-shadow: inset 0 0 0 1px var(--color-primary);' : ''}
								onclick={onDrawToggle}
							>
								DRAW ROUTE
							</button>
							<button
								type="button"
								class="board-chip flex-1"
								style={session.recordMode
									? 'background: color-mix(in srgb, var(--color-error) 18%, transparent); color: var(--color-error); box-shadow: inset 0 0 0 1px var(--color-error);'
									: 'background: color-mix(in srgb, var(--color-error) 8%, transparent); color: var(--color-error);'}
								onclick={onRecordToggle}
							>
								<span class="inline-flex items-center gap-1.5"><span class="rec-dot" aria-hidden="true"></span>REC LIVE</span>
							</button>
						</div>
					</section>

					{#if session.planning || ui.statusMsg}
						<div class="mt-3" role="status" aria-live="polite">
							{#if session.planning}
								<div class="scan-box">
									<div class="scan-line"></div>
								</div>
								<div class="mt-2 flex flex-col gap-1.5">
									{#each ['Geocode stops', 'Route legs', 'Fetch elevation', 'Score gradients'] as step (step)}
										<div class="pipe-step"><span class="pipe-dot pipe-dot-live"></span>{step}</div>
									{/each}
								</div>
							{:else if ui.statusErr}
								<div class="flex items-start gap-2.5 p-3" style="background: color-mix(in srgb, var(--color-error) 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-error) 35%, transparent); border-radius: 8px;">
									<Mark name="alert" cls="size-4 mt-0.5 shrink-0" />
									<div class="min-w-0">
										<p class="m-0 text-[0.82rem] leading-relaxed" style="color: var(--ink-0);">{ui.statusMsg}</p>
										<button type="button" class="mt-2 cursor-pointer font-display text-[0.75rem] font-bold tracking-widest" style="background: transparent; border: none; color: var(--color-error);" onclick={() => runPlan()}>
											↺ RETRY
										</button>
									</div>
								</div>
							{:else}
								<p class="m-0 px-1 text-sm" style="color: var(--ink-2);">{ui.statusMsg}</p>
							{/if}
						</div>
					{/if}
				{/if}
			</div>
		</div>
	</form>
</div>
