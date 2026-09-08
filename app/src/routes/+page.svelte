<script lang="ts">
	import { onMount } from 'svelte';
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import StopList from '$lib/components/StopList.svelte';
	import PresetChips from '$lib/components/PresetChips.svelte';
	import SavedTrips from '$lib/components/SavedTrips.svelte';
	import ModePicker from '$lib/components/ModePicker.svelte';
	import ResultsPanel from '$lib/components/ResultsPanel.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import { app } from '$lib/state/app.svelte.js';
	import { planRoute, locateInto, isMobileView } from '$lib/planner.svelte.js';
	import { enterDrawMode, exitDrawMode, enterRecordMode, exitRecordMode, undoDrawPoint, finishDrawing, finishRecording, recenter } from '$lib/tracker.js';
	import { hideAcList } from '$lib/autocomplete.svelte.js';
	import { ensureMap } from '$lib/mapController.svelte.js';
	import { registerCumulative } from '$lib/state/app.svelte.js';
	import { cumulative } from '$lib/util.js';

	registerCumulative(cumulative);

	let panelEl: HTMLDivElement;
	let grabEl: HTMLButtonElement;
	let panelScrollEl: HTMLDivElement;

	// Swipe (progressive enhancement); the grabber button is the WCAG-safe path.
	let touchStartY: number | null = null;
	function onTouchStart(e: TouchEvent) { if (!isMobileView()) return; touchStartY = e.touches[0].clientY; }
	function onTouchMove(e: TouchEvent) {
		if (touchStartY == null || !isMobileView()) return;
		const dy = e.touches[0].clientY - touchStartY;
		if (dy < -8) { app.setSheet(true); touchStartY = null; }
		else if (dy > 8) { app.setSheet(false); touchStartY = null; }
	}
	function onTouchEnd() { touchStartY = null; }

	function toggleSheet() { app.setSheet(!app.sheetOpen); }
	function onDrawToggle() { if (app.drawMode) exitDrawMode(); else enterDrawMode(); }
	function onRecordToggle() { if (app.recordMode) exitRecordMode(); else enterRecordMode(); }
	function submitPlan(e: SubmitEvent) { e.preventDefault(); planRoute(); }
	function locateFab() { ensureMap(); locateInto(0, true); }

	function updateNet() { app.netOnline = navigator.onLine; }

	onMount(() => {
		updateNet();
		window.addEventListener('online', updateNet);
		window.addEventListener('offline', updateNet);
		const mq = window.matchMedia('(max-width:640px)');
		const applyMq = () => { app.isMobile = mq.matches; if (!mq.matches) app.setSheet(false); };
		applyMq();
		mq.addEventListener('change', applyMq);
		app.boardVal = app.boards[0].value;
		return () => {
			window.removeEventListener('online', updateNet);
			window.removeEventListener('offline', updateNet);
			mq.removeEventListener('change', applyMq);
		};
	});

	function onPanelScroll() { hideAcList(); }
	$effect(() => {
		const onResize = () => hideAcList();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});
</script>

<svelte:head>
	<title>Gradient — skate route planner</title>
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<MapCanvas />
<OnboardingModal />

<!-- FABs -->
<button type="button" class="locate-fab" aria-label="Use my location" title="Use my location" onclick={locateFab}>
	<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9-1h-2.06A7.002 7.002 0 0013 1.06V-1h-2v2.06A7.002 7.002 0 003.06 8H1v2h2.06A7.002 7.002 0 0011 16.94V19h2v-2.06A7.002 7.002 0 0019.94 10H21V8zm-9 8a5 5 0 110-10 5 5 0 010 10z"/></svg>
</button>
<button type="button" class="locate-fab recenter-fab" class:hidden={!app.recenterVisible}
	aria-label="Re-center on live position" title="Re-center" onclick={() => recenter()}>
	<svg viewBox="0 0 24 24"><path d="M12 2 4 21l8-4.5L20 21 12 2z"/></svg>
</button>

<!-- draw toolbar (was DrawToolbar.svelte) -->
{#if app.drawMode}
	<div class="draw-toolbar" role="status" aria-live="polite">
		<span id="drawCount">{app.drawPoints.length} point{app.drawPoints.length === 1 ? '' : 's'}</span>
		<span class="draw-hint">Tap the map to trace your route</span>
		<span class="draw-actions">
			<button type="button" onclick={undoDrawPoint} title="Remove last point">Undo</button>
			<button type="button" id="drawFinishBtn" onclick={finishDrawing} disabled={app.drawPoints.length < 2} title="Finish and score this route">Finish</button>
			<button type="button" onclick={exitDrawMode} title="Cancel drawing">Cancel</button>
		</span>
	</div>
{/if}

<!-- record toolbar (was RecordToolbar.svelte) -->
{#if app.recordMode}
	<div class="draw-toolbar" role="status" aria-live="polite">
		<span class="rec-dot" aria-hidden="true"></span>
		<span id="recordCount">{app.recordKm.toFixed(2)} km</span>
		<span class="draw-hint">Recording your live path — move to trace it</span>
		<span class="draw-actions">
			<button type="button" id="recordFinishBtn" onclick={finishRecording} disabled={app.recordPoints.length < 2} title="Finish and score this route">Finish</button>
			<button type="button" onclick={exitRecordMode} title="Cancel recording">Cancel</button>
		</span>
	</div>
{/if}

<!-- panel -->
<div class="panel" class:sheet-open={app.sheetOpen} bind:this={panelEl}>
	<button type="button" class="grabber" bind:this={grabEl}
		aria-expanded={app.sheetOpen} aria-controls="panelScroll"
		aria-label={app.sheetOpen ? 'Collapse route panel' : 'Expand route panel'}
		onclick={toggleSheet} ontouchstart={onTouchStart} ontouchmove={onTouchMove} ontouchend={onTouchEnd}>
		<span aria-hidden="true"></span>
	</button>
	<div class="panel-scroll" id="panelScroll" bind:this={panelScrollEl} onscroll={onPanelScroll}>
		<div class="brand">
			<span class="dot" aria-hidden="true">
				<svg viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/></svg>
			</span>
			<div style="flex:1;min-width:0;">
				<h1>Gradient</h1>
				<p>Micromobility route lab — climb / brake / range</p>
			</div>
			<!-- NetBadge (was NetBadge.svelte) -->
			<span class="netbadge" class:off={!app.netOnline}><span class="pip"></span><span>{app.netOnline ? 'Online' : 'Offline'}</span></span>
		</div>

		<form class="plan" onsubmit={submitPlan}>
			<div class="stickystops">
				<StopList />
				<div class="stops-actions">
					<button type="button" class="add-stop" onclick={() => app.addStop()}>
						<span class="plus"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/></svg></span>
						Add stop
					</button>
					<button type="button" class="locatebtn" onclick={() => locateInto(app.activeStopIndex, false)}>
						<svg viewBox="0 0 24 24"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9-1h-2.06A7.002 7.002 0 0013 1.06V-1h-2v2.06A7.002 7.002 0 003.06 8H1v2h2.06A7.002 7.002 0 0011 16.94V19h2v-2.06A7.002 7.002 0 0019.94 10H21V8zm-9 8a5 5 0 110-10 5 5 0 010 10z"/></svg>
						Use my location
					</button>
				</div>
			</div>

			<div class="panel-card">
				<p class="sectionlabel">Saved places</p>
				<div class="presets"><PresetChips /></div>
			</div>

			{#if !app.netOnline}
				<div class="offlinehint">{app.offlineHint}</div>
			{/if}

			<SavedTrips />

			<div class="panel-card">
				<p class="sectionlabel">Ride</p>
				<div class="tmodes" role="radiogroup" aria-label="Transport mode">
					<ModePicker variant="panel" />
				</div>
			</div>

			{#if !app.planControlsHidden}
				<div class="panel-card">
					<p class="sectionlabel">Board // Powertrain</p>
					<!-- BoardPicker (was BoardPicker.svelte) -->
					<div class="chips" role="radiogroup" aria-label="Board">
						{#each app.boards as b, i (b.value)}
							<span class="chip">
								<input type="radio" name="board" id="board{i + 1}" value={b.value}
									checked={(app.boardVal || app.boards[0].value) === b.value}
									onchange={() => (app.boardVal = b.value)} />
								<label for="board{i + 1}">{b.label}</label>
							</span>
						{/each}
					</div>

					<button type="submit" class="go" disabled={app.planning}>
						<svg class="bolt" viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2z"/></svg>
						Plan route
					</button>
					<button type="button" class="add-stop" id="drawToggleBtn" class:active={app.drawMode} onclick={onDrawToggle}>
						<span class="plus"><svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span>
						Draw a route — for shortcuts routing won't find
					</button>
					<button type="button" class="add-stop" id="recordToggleBtn" class:active={app.recordMode} onclick={onRecordToggle}>
						<span class="plus"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg></span>
						Record live — trace it as you ride
					</button>
				</div>
			{/if}
			<div class="status" class:err={app.statusErr} class:busy={app.statusBusy} role="status" aria-live="polite">
				{app.statusMsg}
			</div>
		</form>

		<ResultsPanel />
	</div>

	<!-- LegalNote (was LegalNote.svelte) -->
	{#if !app.legalDismissed}
		<div class="legal">
			<button type="button" class="legal-x" aria-label="Dismiss legal note" onclick={() => app.dismissLegal()}>
				<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
			</button>
			<strong>Legal note.</strong> Electric skateboards cannot legally be ridden on public roads or
			pavements in South Africa — no registration category exists for a motorised skateboard under the
			National Road Traffic Act 93 of 1996, and pavements form part of the public road reserve. Treat
			this as planning for private property, estates, campuses and trails unless you've confirmed your
			own legal position.
		</div>
		<button type="button" class="legal-mini hidden" onclick={() => app.restoreLegal()}>
			<strong>Legal note hidden</strong> — Show
		</button>
	{:else}
		<div class="legal hidden"></div>
		<button type="button" class="legal-mini" onclick={() => app.restoreLegal()}>
			<strong>Legal note hidden</strong> — Show
		</button>
	{/if}
</div>

<style>
	.recenter-fab.hidden { display: none; }
</style>
