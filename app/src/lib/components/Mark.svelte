<script lang="ts">
	export type MarkName =
		| 'sun'
		| 'moon'
		| 'monitor'
		| 'pin'
		| 'crosshair'
		| 'bookmark'
		| 'x'
		| 'swap'
		| 'play'
		| 'stop'
		| 'pause'
		| 'undo'
		| 'check'
		| 'alert'
		| 'route'
		| 'layers';

	let { name, cls = '' }: { name: MarkName; cls?: string } = $props();

	const paths: Record<MarkName, string> = {
		sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8"/>',
		moon: '<path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z"/>',
		monitor:
			'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
		pin: '<path d="M12 21s-7-5.4-7-11a7 7 0 0 1 14 0c0 5.6-7 11-7 11z"/><circle cx="12" cy="10" r="2.4"/>',
		crosshair:
			'<circle cx="12" cy="12" r="6.5"/><path d="M12 2.5V6M12 18v3.5M2.5 12H6M18 12h3.5"/>',
		bookmark: '<path d="M7 3.5h10V21l-5-3.8L7 21z"/>',
		x: '<path d="M6 6l12 12M18 6L6 18"/>',
		swap: '<path d="M7 3.5V20m0 0l-3.5-3.5M7 20l3.5-3.5M17 20.5V4m0 0l-3.5 3.5M17 4l3.5 3.5"/>',
		play: '<path d="M8 5l11 7-11 7z"/>',
		stop: '<rect x="7" y="7" width="10" height="10" rx="1"/>',
		pause: '<path d="M9 5v14M15 5v14"/>',
		undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h9a7 7 0 1 1 0 14h-4"/>',
		check: '<path d="M4 12.5l5 5L20 6.5"/>',
		alert: '<path d="M12 3.5L22 20H2z"/><path d="M12 10v4.5M12 17.4v.4"/>',
		route:
			'<path d="M5 19Q9 14 13 11T20 5"/><circle cx="5" cy="19" r="2.2" fill="currentColor" stroke="none"/><circle cx="20" cy="5" r="2.2" fill="currentColor" stroke="none"/>',
		layers: '<path d="M12 3l9 4.5-9 4.5-9-4.5z"/><path d="M3.5 12.5L12 16.7l8.5-4.2"/><path d="M3.5 16.5L12 20.7l8.5-4.2"/>'
	};
</script>

<svg
	class={cls}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{@html paths[name]}
</svg>
