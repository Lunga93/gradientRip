<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import type * as LeafletTypes from 'leaflet';
	import { ensureLeaflet } from '$lib/mapController.svelte.js';
	import { hazardIcon } from '$lib/hazards.js';

	export interface MiniMapPin {
		lat: number;
		lon: number;
		kind: string;
		label: string;
	}

	let {
		line = [],
		pins = [],
		picking = false,
		picked = null,
		onPick
	}: {
		line: [number, number][];
		pins: MiniMapPin[];
		picking?: boolean;
		picked?: [number, number] | null;
		onPick?: (latlon: [number, number]) => void;
	} = $props();

	let container = $state<HTMLDivElement | undefined>(undefined);
	let map = $state<LeafletTypes.Map | null>(null);
	let Leaf = $state<typeof LeafletTypes | null>(null);
	let layers: LeafletTypes.LayerGroup | null = null;
	const pickingRef = $derived(picking);

	const escHtml = (s: string): string =>
		s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

	const drawLayers = (fit: boolean): void => {
		const L = Leaf;
		const m = map;
		if (!L || !m) return;
		layers?.remove();
		layers = L.layerGroup().addTo(m);
		if (line.length > 1) {
			L.polyline(line, { color: '#60a5fa', weight: 4, opacity: 0.9 }).addTo(layers);
		}
		for (const p of pins) {
			if (!Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
			L.marker([p.lat, p.lon], {
				icon: L.divIcon({
					className: '',
					html: `<div class="hz-pin" title="${escHtml(p.label)}">${escHtml(hazardIcon(p.kind))}</div>`,
					iconSize: [28, 28],
					iconAnchor: [14, 14]
				}),
				keyboard: false,
				title: p.label
			}).addTo(layers);
		}
		if (picked) {
			L.marker(picked, {
				icon: L.divIcon({
					className: '',
					html: '<div class="hz-picked" title="Dropped pin"></div>',
					iconSize: [22, 22],
					iconAnchor: [11, 11]
				}),
				keyboard: false,
				title: 'Dropped pin'
			}).addTo(layers);
		}
		if (fit) {
			const pts: [number, number][] = [...line];
			for (const p of pins) {
				if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) pts.push([p.lat, p.lon]);
			}
			if (pts.length > 1) m.fitBounds(L.latLngBounds(pts), { padding: [24, 24] });
			else if (pts.length === 1) m.setView(pts[0], 15);
			else m.setView([0, 0], 2);
		}
		if (container) container.style.cursor = pickingRef ? 'crosshair' : '';
	};

	onMount(() => {
		let cancelled = false;
		(async () => {
			const L = await ensureLeaflet();
			if (cancelled || !container) return;
			Leaf = L;
			// Lean + tap-through: no zoom-control bloat, wheel-zoom off so the
			// page keeps scrolling; taps register (picking mode reads them).
			const m = L.map(container, { zoomControl: false, scrollWheelZoom: false });
			L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: '© OpenStreetMap contributors'
			}).addTo(m);
			m.on('click', (e: LeafletTypes.LeafletMouseEvent) => {
				if (pickingRef) onPick?.([e.latlng.lat, e.latlng.lng]);
			});
			map = m;
			drawLayers(true);
		})();
		return () => {
			cancelled = true;
		};
	});

	// Structural changes refit; pin-pick updates redraw without refitting
	// (so tapping the map doesn't yank the viewport on every pick).
	$effect(() => {
		void line;
		void pins;
		const m = map;
		if (!m) return;
		untrack(() => drawLayers(true));
	});
	$effect(() => {
		void picked;
		void pickingRef;
		const m = map;
		if (!m) return;
		untrack(() => drawLayers(false));
	});

	onDestroy(() => {
		layers?.remove();
		layers = null;
		map?.remove();
		map = null;
	});
</script>

<div class="minimap" bind:this={container} role="img" aria-label="Route map with hazard pins"></div>

<style>
	.minimap {
		width: 100%;
		height: 220px;
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		overflow: hidden;
		background: var(--surface-sunken);
	}

	.minimap :global(.hz-pin) {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #1b2125;
		border: 2px solid #f59e0b;
		color: #fbbf24;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		line-height: 1;
		box-shadow: 0 0 8px rgba(245, 158, 11, 0.55);
	}

	.minimap :global(.hz-picked) {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #60a5fa;
		border: 3px solid #ffffff;
		box-shadow: 0 0 10px rgba(96, 165, 250, 0.8);
	}
</style>
