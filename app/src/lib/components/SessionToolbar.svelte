<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import {
		exitDrawMode,
		undoDrawPoint,
		finishDrawing,
		finishRecording,
		pauseTracking,
		resumeTracking,
		stopTracking,
		finishRide,
		recenter
	} from '$lib/tracker.js';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let now = $state(Date.now());

	$effect(() => {
		if (!session.trackingActive && !session.recordMode) return;
		const id = window.setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => window.clearInterval(id);
	});

	const fmtElapsed = (start: number | null): string => {
		if (start == null) return '00:00';
		const s = Math.max(0, Math.floor((now - start) / 1000));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
		return `${h > 0 ? h + ':' : ''}${mm}:${String(sec).padStart(2, '0')}`;
	};

	const battLeft = $derived(
		domain.results ? Math.max(0, 100 - (domain.results.totalWh / domain.results.usableWh) * 100) : null
	);
</script>

{#if session.drawMode}
	<div class="draw-toolbar" role="status" aria-live="polite">
		<span class="verdict-tag" style="--vt: var(--color-primary);">
			{#if session.drawPoints.length === 1}1 point{:else}{session.drawPoints.length} points{/if}
		</span>
		<span class="hidden text-[0.78rem] sm:inline" style="color: var(--ink-2);">Tap the map to trace your route</span>
		<span class="flex gap-1.5">
			<SlashButton label="Undo" size="xs" variant="secondary" onclick={undoDrawPoint} title="Remove last point" />
			<SlashButton
				label="Finish"
				size="xs"
				onclick={() => finishDrawing()}
				disabled={session.drawPoints.length < 2}
				title="Finish and score this route"
			/>
			<SlashButton label="Cancel" size="xs" variant="secondary" onclick={exitDrawMode} title="Cancel drawing" />
		</span>
	</div>
{/if}

{#if session.recordMode}
	<div
		class="fixed top-4 left-1/2 z-20 -translate-x-1/2 md:left-[calc(50%+206px)]"
		role="status"
		aria-live="polite"
		aria-label="Recording in progress"
	>
		<div class="rec-pill">
			<span class="rec-dot" aria-hidden="true"></span>
			<span class="font-mono2 text-[0.7rem] font-bold tracking-widest" style="color: var(--color-error);">REC</span>
			<span class="font-mono2 text-[0.7rem] tabular-nums" style="color: var(--ink-0);">
				{fmtElapsed(session.recordStartedAt)}
			</span>
		</div>
	</div>
	<div class="hud-band clip-chamfer-tr fixed top-16 left-4 z-20 flex-col md:left-[424px]" aria-label="Recording stats">
		<div class="hud-cell hud-cell-left px-4 py-2.5">
			<span class="k">DISTANCE</span>
			<span class="v" style="color: var(--ink-0); font-size: 1.1rem;">{session.recordKm.toFixed(2)}<small>km</small></span>
		</div>
		<div class="hud-cell hud-cell-left px-4 py-2.5" style="box-shadow: inset 0 1px 0 var(--panel-line);">
			<span class="k">DURATION</span>
			<span class="v" style="color: var(--ink-0); font-size: 1.1rem;">{fmtElapsed(session.recordStartedAt)}</span>
		</div>
		<div class="hud-cell hud-cell-left px-4 py-2.5" style="box-shadow: inset 0 1px 0 var(--panel-line);">
			<span class="k">SPEED</span>
			<span class="v" style="color: var(--color-accent); font-size: 1.1rem;">
				{session.recordSpeedKmh != null ? session.recordSpeedKmh.toFixed(0) : '—'}<small>km/h</small>
			</span>
		</div>
		<div class="hud-cell hud-cell-left px-4 py-2.5" style="box-shadow: inset 0 1px 0 var(--panel-line);">
			<span class="k">GPS ACC</span>
			<span class="v" style="color: var(--ink-1); font-size: 1.1rem;">
				{session.recordAcc != null ? `±${Math.round(session.recordAcc)}` : '—'}<small>m</small>
			</span>
		</div>
	</div>
	<div class="fixed bottom-[calc(28px+env(safe-area-inset-bottom,0px))] left-1/2 z-20 -translate-x-1/2 md:left-[calc(50%+206px)]">
		<SlashButton label="■ Stop recording" variant="danger" onclick={() => finishRecording()} title="Finish and score this route" />
	</div>
{/if}

{#if session.trackingActive}
	<div
		class="hud-band clip-chamfer-bl fixed top-4 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 overflow-x-auto md:left-[calc(50%+206px)]"
		role="status"
		aria-live="polite"
		aria-label="Live ride stats"
	>
		<div class="hud-cell">
			<span class="k">REMAINING</span>
			<span class="v" style="color: var(--color-accent);">{session.trackingStats?.remainingKm ?? '—'}</span>
		</div>
		<div class="hud-cell">
			<span class="k">ELAPSED</span>
			<span class="v" style="color: var(--ink-0);">{fmtElapsed(session.trackingStartedAt)}</span>
		</div>
		<div class="hud-cell">
			<span class="k">SPEED</span>
			<span class="v" style="color: var(--ink-0);">
				{session.trackingStats?.speedKmh ?? '—'}{#if session.trackingStats?.speedKmh && session.trackingStats.speedKmh !== '—'}<small>km/h</small>{/if}
			</span>
		</div>
		{#if battLeft != null}
			<div class="hud-cell">
				<span class="k">BATTERY</span>
				<span class="v" style="color: var(--v-go);">{battLeft.toFixed(0)}<small>%</small></span>
			</div>
		{/if}
		<div class="hud-cell">
			<span class="k">GPS</span>
			<span class="v" style="color: var(--ink-2); font-size: 1rem;">{session.trackingStats?.acc ?? '—'}</span>
		</div>
	</div>
	<div
		class="fixed left-1/2 z-20 -translate-x-1/2 md:left-[calc(50%+206px)] {ui.panelVisible &&
		ui.isMobile
			? 'bottom-[calc(160px+env(safe-area-inset-bottom,0px))]'
			: 'bottom-[calc(20px+env(safe-area-inset-bottom,0px))]'}"
	>
		<div class="hud-band" style="border-radius: 12px;" role="toolbar" aria-label="Ride controls">
			{#if session.trackingPaused}
				<button type="button" class="grid cursor-pointer place-items-center gap-1 bg-transparent px-5 py-3" style="border: none; color: var(--color-primary);" onclick={resumeTracking} title="Resume GPS tracking">
					<Mark name="play" cls="size-5" />
					<span class="font-mono2 text-[0.58rem] tracking-widest">RESUME</span>
				</button>
			{:else}
				<button type="button" class="grid cursor-pointer place-items-center gap-1 bg-transparent px-5 py-3" style="border: none; color: var(--ink-1);" onclick={pauseTracking} title="Pause GPS tracking">
					<Mark name="pause" cls="size-5" />
					<span class="font-mono2 text-[0.58rem] tracking-widest">PAUSE</span>
				</button>
			{/if}
			<button type="button" class="grid cursor-pointer place-items-center gap-1 bg-transparent px-5 py-3" style="border: none; border-left: 1px solid var(--panel-line); color: var(--ink-1);" onclick={() => recenter()} title="Re-center on live position">
				<Mark name="crosshair" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">CENTER</span>
			</button>
			<button type="button" class="grid cursor-pointer place-items-center gap-1 bg-transparent px-5 py-3" style="border: none; border-left: 1px solid var(--panel-line); color: var(--color-error);" onclick={() => stopTracking()} title="Stop tracking">
				<Mark name="stop" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">STOP</span>
			</button>
			<button type="button" class="grid cursor-pointer place-items-center gap-1 px-5 py-3" style="border: none; border-left: 1px solid var(--panel-line); background: color-mix(in srgb, var(--color-primary) 22%, transparent); color: var(--color-primary);" onclick={() => finishRide()} title="Finish the ride">
				<Mark name="check" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">FINISH</span>
			</button>
		</div>
	</div>
{/if}
