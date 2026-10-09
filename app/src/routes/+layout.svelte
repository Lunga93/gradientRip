<script lang="ts">
	import '../app.css';

	let { children }: { children?: import('svelte').Snippet } = $props();

	$effect(() => {
		if (import.meta.env.PROD && 'serviceWorker' in navigator) {
			navigator.serviceWorker.register('/service-worker.js').catch(() => {
			});
		}
		const warmLeaflet = (): void => {
			import('$lib/mapController.svelte.js')
				.then((m) => m.ensureLeaflet())
				.catch(() => {
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