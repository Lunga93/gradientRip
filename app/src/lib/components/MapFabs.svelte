<script lang="ts">
	import Mark from '$lib/components/Mark.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { locateInto } from '$lib/planner.svelte.js';
	import { recenter } from '$lib/tracker.js';
	import { ensureMap, setMapStyle } from '$lib/mapController.svelte.js';
	import { getAvailableStyles } from '$lib/mapStyles.js';
	import { loadMapStylePref } from '$lib/storage.js';

	const locateFab = (): void => {
		ensureMap();
		locateInto(0, true);
	};

	// Map style picker — 'auto' follows the app theme, otherwise a pinned look.
	let styleOpen = $state(false);
	let stylePref = $state(loadMapStylePref());

	const styles = getAvailableStyles();
	const lightStyles = styles.filter((s) => s.group === 'light');
	const darkStyles = styles.filter((s) => s.group === 'dark');

	const pickStyle = (id: string): void => {
		stylePref = id;
		setMapStyle(id);
		styleOpen = false;
	};

	// Tiny swatch per style so the list reads at a glance.
	const swatch = (id: string): string =>
		({
			voyager: 'linear-gradient(135deg,#e8f4e8 40%,#f6d9a0 40% 65%,#a8d8f0 65%)',
			positron: 'linear-gradient(135deg,#ededed 60%,#d0d0d0 60%)',
			watercolor: 'linear-gradient(135deg,#cfe8d8 30%,#f0e0c0 60%,#bcd4e8 90%)',
			'toner-lite': 'linear-gradient(135deg,#ffffff 55%,#222 55%)',
			alidade: 'linear-gradient(135deg,#f2f4f8 60%,#dbe3ec 60%)',
			osm: 'linear-gradient(135deg,#e8f0e0 45%,#f8e8c8 45% 70%,#c8e0f0 70%)',
			darkmatter: 'linear-gradient(135deg,#1a1a24 60%,#2a2a3a 60%)',
			'alidade-dark': 'linear-gradient(135deg,#101826 55%,#1c2c44 55%)'
		})[id] ?? '#888';
</script>

<!-- hidden while the mobile sheet is open so they don't cover it -->
{#if !(ui.isMobile && ui.sheetOpen)}
	<button
		class="fab-btn fixed right-3 bottom-[calc(196px+env(safe-area-inset-bottom,0px))] z-30 md:right-4 md:bottom-4 md:left-auto"
		aria-label="Use my location"
		title="Use my location"
		onclick={locateFab}
	>
		<Mark name="pin" cls="" />
	</button>
	<button
		class="fab-btn fixed right-3 bottom-[calc(308px+env(safe-area-inset-bottom,0px))] z-30 md:right-4 md:bottom-[7.5rem] md:left-auto"
		aria-label="Change map style"
		title="Map style"
		aria-expanded={styleOpen}
		onclick={() => (styleOpen = !styleOpen)}
	>
		<Mark name="layers" cls="" />
	</button>
	{#if styleOpen}
		<button
			class="fixed inset-0 z-30 cursor-default bg-transparent"
			style="border: none;"
			aria-label="Close map style picker"
			onclick={() => (styleOpen = false)}
		></button>
		<div
			class="style-menu fixed right-3 bottom-[calc(364px+env(safe-area-inset-bottom,0px))] z-30 md:right-4 md:bottom-[11rem]"
			role="menu"
			aria-label="Map styles"
		>
			<h4>THEME</h4>
			<button
				type="button"
				role="menuitemradio"
				aria-checked={stylePref === 'auto'}
				class="style-row {stylePref === 'auto' ? 'active' : ''}"
				onclick={() => pickStyle('auto')}
			>
				<span class="dot" style="background: linear-gradient(135deg,#f0f0f0 50%,#14141e 50%);"></span>
				<span class="t"><strong>Auto</strong><span>Follow app theme</span></span>
				{#if stylePref === 'auto'}<Mark name="check" cls="" />{/if}
			</button>
			<h4>LIGHT</h4>
			{#each lightStyles as s (s.id)}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={stylePref === s.id}
					class="style-row {stylePref === s.id ? 'active' : ''}"
					onclick={() => pickStyle(s.id)}
				>
					<span class="dot" style="background: {swatch(s.id)};"></span>
					<span class="t"><strong>{s.name}</strong><span>{s.blurb}</span></span>
					{#if stylePref === s.id}<Mark name="check" cls="" />{/if}
				</button>
			{/each}
			<h4>DARK</h4>
			{#each darkStyles as s (s.id)}
				<button
					type="button"
					role="menuitemradio"
					aria-checked={stylePref === s.id}
					class="style-row {stylePref === s.id ? 'active' : ''}"
					onclick={() => pickStyle(s.id)}
				>
					<span class="dot" style="background: {swatch(s.id)};"></span>
					<span class="t"><strong>{s.name}</strong><span>{s.blurb}</span></span>
					{#if stylePref === s.id}<Mark name="check" cls="" />{/if}
				</button>
			{/each}
		</div>
	{/if}
{/if}
{#if session.recenterVisible && !(ui.isMobile && ui.sheetOpen)}
	<button
		class="fab-btn fixed right-3 bottom-[calc(252px+env(safe-area-inset-bottom,0px))] z-30 md:right-4 md:bottom-[4.5rem] md:left-auto"
		aria-label="Re-center on live position"
		title="Re-center"
		onclick={() => recenter()}
	>
		<Mark name="crosshair" cls="" />
	</button>
{/if}
