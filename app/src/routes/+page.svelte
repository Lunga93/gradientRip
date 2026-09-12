<script lang="ts">
	import { onMount } from 'svelte';
	import MapCanvas from '$lib/components/MapCanvas.svelte';
	import OnboardingModal from '$lib/components/OnboardingModal.svelte';
	import PanelHeader from '$lib/components/PanelHeader.svelte';
	import PlanView from '$lib/components/PlanView.svelte';
	import SavedView from '$lib/components/SavedView.svelte';
	import RideView from '$lib/components/RideView.svelte';
	import LegalNote from '$lib/components/LegalNote.svelte';
	import TabBar from '$lib/components/TabBar.svelte';
	import MapFabs from '$lib/components/MapFabs.svelte';
	import SessionToolbar from '$lib/components/SessionToolbar.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { domain } from '$lib/state/domain.svelte.js';
	import { verdictColor } from '$lib/verdictTheme.js';
	import { isMobileView } from '$lib/planner.svelte.js';
	import { hideAcList } from '$lib/autocomplete.svelte.js';

	let panelScrollEl = $state<HTMLDivElement>();

	let touchStartY: number | null = null;
	const onTouchStart = (e: TouchEvent): void => {
		if (!isMobileView()) return;
		touchStartY = e.touches[0].clientY;
	};
	const onTouchMove = (e: TouchEvent): void => {
		if (touchStartY == null || !isMobileView()) return;
		const dy = e.touches[0].clientY - touchStartY;
		if (dy < -8) {
			ui.setSheet(true);
			touchStartY = null;
		} else if (dy > 8) {
			ui.setSheet(false);
			touchStartY = null;
		}
	};
	const onTouchEnd = (): void => {
		touchStartY = null;
	};

	const toggleSheet = (): void => {
		ui.setSheet(!ui.sheetOpen);
	};
	const updateNet = (): void => {
		ui.netOnline = navigator.onLine;
	};
	const onPanelScroll = (): void => {
		hideAcList();
	};

	const panelEdge = $derived(
		domain.results
			? `--verdict-edge: linear-gradient(90deg, ${verdictColor(domain.results.verdict.level)} 0%, transparent 100%); box-shadow: 0 0 60px color-mix(in srgb, ${verdictColor(domain.results.verdict.level)} 22%, transparent), 0 8px 48px rgba(0, 0, 0, 0.45); border-color: color-mix(in srgb, ${verdictColor(domain.results.verdict.level)} 45%, transparent);`
			: ''
	);

	onMount(() => {
		updateNet();
		window.addEventListener('online', updateNet);
		window.addEventListener('offline', updateNet);
		const mq = window.matchMedia('(max-width:640px)');
		const applyMq = () => {
			ui.isMobile = mq.matches;
			if (!mq.matches) ui.setSheet(false);
		};
		applyMq();
		mq.addEventListener('change', applyMq);
		return () => {
			window.removeEventListener('online', updateNet);
			window.removeEventListener('offline', updateNet);
			mq.removeEventListener('change', applyMq);
		};
	});

	$effect(() => {
		const onResize = () => hideAcList();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	$effect(() => {
		if (ui.activeTab === 'ride' && panelScrollEl && typeof panelScrollEl.scrollTo === 'function') {
			panelScrollEl.scrollTo({ top: 0 });
		}
	});
</script>

<svelte:head>
	<title>GradientRip — e-skate route planner</title>
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<MapCanvas />
<OnboardingModal />
<MapFabs />
<SessionToolbar />

<!-- panel -->
{#if ui.panelVisible}
	<div class="panel" class:sheet-open={ui.sheetOpen} style={panelEdge}>
		<button
			type="button"
			class="grabber"
			aria-expanded={ui.sheetOpen}
			aria-controls="panelScroll"
			aria-label={ui.sheetOpen ? 'Collapse route panel' : 'Expand route panel'}
			onclick={toggleSheet}
			ontouchstart={onTouchStart}
			ontouchmove={onTouchMove}
			ontouchend={onTouchEnd}
		>
			<span aria-hidden="true"></span>
		</button>
		<PanelHeader />
		<TabBar />
		<div class="panel-scroll" id="panelScroll" bind:this={panelScrollEl} onscroll={onPanelScroll}>
			<PlanView />
			<SavedView />
			<RideView />
		</div>
		<LegalNote />
	</div>
{/if}
