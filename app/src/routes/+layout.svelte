<script lang="ts">
	import '../app.css';

	let { children }: { children?: import('svelte').Snippet } = $props();

	// The built src/service-worker.js is emitted as /service-worker.js by the
	// SvelteKit build — register it so the offline app shell engages. Dev has
	// no service worker build, so only register in production.
	$effect(() => {
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
				/* offline shell is a progressive enhancement — ignore */
			});
		}
		// Leaflet rides a dynamic import so the first paint stays lean — warm
		// that chunk once the browser idles so the map is ready when asked.
		const warmLeaflet = (): void => {
			import('$lib/mapController.svelte.js')
				.then((m) => m.ensureLeaflet())
				.catch(() => {
					/* offline on first paint — MapCanvas loads it on demand */
				});
		};
		const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => void })
			.requestIdleCallback;
		if (idle) idle(warmLeaflet);
		else setTimeout(warmLeaflet, 2000);
	});
</script>

<svelte:head>
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#eef1f3" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0e10" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

{@render children?.()}