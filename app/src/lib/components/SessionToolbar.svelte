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
	<div class="border-base-300 bg-base-100 absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-box border px-3 py-2 shadow-lg" role="status" aria-live="polite">
		<span class="badge badge-primary badge-soft">
			{#if session.drawPoints.length === 1}1 point{:else}{session.drawPoints.length} points{/if}
		</span>
		<span class="hidden text-[0.78rem] text-base-content/70 sm:inline">Tap the map to trace your route</span>
		<span class="join">
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
		<div class="badge badge-error badge-lg gap-2">
			<span class="rec-dot" aria-hidden="true"></span>
			<span class="font-mono2 text-[0.7rem] font-bold tracking-widest">REC</span>
			<span class="font-mono2 text-[0.7rem] tabular-nums">
				{fmtElapsed(session.recordStartedAt)}
			</span>
		</div>
	</div>
	<div class="stats stats-vertical fixed top-16 left-4 z-20 shadow-lg md:left-[424px]" aria-label="Recording stats">
		<div class="stat px-4 py-2.5">
			<span class="stat-title font-mono2 text-[0.6rem]">DISTANCE</span>
			<span class="stat-value font-display text-[1.1rem]">{session.recordKm.toFixed(2)}<span class="font-mono2 ml-1 text-xs font-medium opacity-70">km</span></span>
		</div>
		<div class="stat px-4 py-2.5">
			<span class="stat-title font-mono2 text-[0.6rem]">DURATION</span>
			<span class="stat-value font-display text-[1.1rem]">{fmtElapsed(session.recordStartedAt)}</span>
		</div>
		<div class="stat px-4 py-2.5">
			<span class="stat-title font-mono2 text-[0.6rem]">SPEED</span>
			<span class="stat-value font-display text-[1.1rem] text-accent">
				{session.recordSpeedKmh != null ? session.recordSpeedKmh.toFixed(0) : '—'}<span class="font-mono2 ml-1 text-xs font-medium opacity-70">km/h</span>
			</span>
		</div>
		<div class="stat px-4 py-2.5">
			<span class="stat-title font-mono2 text-[0.6rem]">GPS ACC</span>
			<span class="stat-value font-display text-[1.1rem]">
				{session.recordAcc != null ? `±${Math.round(session.recordAcc)}` : '—'}<span class="font-mono2 ml-1 text-xs font-medium opacity-70">m</span>
			</span>
		</div>
	</div>
	<div class="fixed bottom-[calc(28px+env(safe-area-inset-bottom,0px))] left-1/2 z-20 -translate-x-1/2 md:left-[calc(50%+206px)]">
		<SlashButton label="■ Stop recording" variant="danger" onclick={() => finishRecording()} title="Finish and score this route" />
	</div>
{/if}

{#if session.trackingActive}
	<div
		class="stats fixed top-4 left-1/2 z-20 max-w-[calc(100vw-2rem)] -translate-x-1/2 shadow-lg md:left-[calc(50%+206px)]"
		role="status"
		aria-live="polite"
		aria-label="Live ride stats"
	>
		<div class="stat px-4 py-2">
			<span class="stat-title font-mono2 text-[0.6rem]">REMAINING</span>
			<span class="stat-value font-display text-lg text-accent">{session.trackingStats?.remainingKm ?? '—'}</span>
		</div>
		<div class="stat px-4 py-2">
			<span class="stat-title font-mono2 text-[0.6rem]">ELAPSED</span>
			<span class="stat-value font-display text-lg">{fmtElapsed(session.trackingStartedAt)}</span>
		</div>
		<div class="stat px-4 py-2">
			<span class="stat-title font-mono2 text-[0.6rem]">SPEED</span>
			<span class="stat-value font-display text-lg">
				{session.trackingStats?.speedKmh ?? '—'}{#if session.trackingStats?.speedKmh && session.trackingStats.speedKmh !== '—'}<span class="font-mono2 ml-1 text-xs font-medium opacity-70">km/h</span>{/if}
			</span>
		</div>
		{#if battLeft != null}
			<div class="stat px-4 py-2">
				<span class="stat-title font-mono2 text-[0.6rem]">BATTERY</span>
				<span class="stat-value font-display text-lg text-success">{battLeft.toFixed(0)}<span class="font-mono2 ml-1 text-xs font-medium opacity-70">%</span></span>
			</div>
		{/if}
		<div class="stat px-4 py-2">
			<span class="stat-title font-mono2 text-[0.6rem]">GPS</span>
			<span class="stat-value font-display text-base">{session.trackingStats?.acc ?? '—'}</span>
		</div>
	</div>
	<div
		class="fixed left-1/2 z-20 -translate-x-1/2 md:left-[calc(50%+206px)] {ui.panelVisible &&
		ui.isMobile
			? 'bottom-[calc(160px+env(safe-area-inset-bottom,0px))]'
			: 'bottom-[calc(20px+env(safe-area-inset-bottom,0px))]'}"
	>
		<div class="join border-base-300 bg-base-100 border shadow-lg" role="toolbar" aria-label="Ride controls">
			{#if session.trackingPaused}
				<button type="button" class="btn btn-ghost join-item gap-1 px-5 py-3 text-primary" onclick={resumeTracking} title="Resume GPS tracking">
					<Mark name="play" cls="size-5" />
					<span class="font-mono2 text-[0.58rem] tracking-widest">RESUME</span>
				</button>
			{:else}
				<button type="button" class="btn btn-ghost join-item gap-1 px-5 py-3" onclick={pauseTracking} title="Pause GPS tracking">
					<Mark name="pause" cls="size-5" />
					<span class="font-mono2 text-[0.58rem] tracking-widest">PAUSE</span>
				</button>
			{/if}
			<button type="button" class="btn btn-ghost join-item gap-1 px-5 py-3" onclick={() => recenter()} title="Re-center on live position">
				<Mark name="crosshair" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">CENTER</span>
			</button>
			<button type="button" class="btn btn-ghost join-item gap-1 px-5 py-3 text-error" onclick={() => stopTracking()} title="Stop tracking">
				<Mark name="stop" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">STOP</span>
			</button>
			<button type="button" class="btn btn-primary join-item gap-1 px-5 py-3" onclick={() => finishRide()} title="Finish the ride">
				<Mark name="check" cls="size-5" />
				<span class="font-mono2 text-[0.58rem] tracking-widest">FINISH</span>
			</button>
		</div>
	</div>
{/if}
