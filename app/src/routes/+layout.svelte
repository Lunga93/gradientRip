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
	});
</script>

<svelte:head>
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#eef1f3" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b0e10" />
	<meta name="mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
</svelte:head>

{@render children?.()}