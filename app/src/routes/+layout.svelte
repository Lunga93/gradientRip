<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import OnboardingWizard from '$lib/components/OnboardingWizard.svelte';
	import LegalNote from '$lib/components/LegalNote.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { initCloudBackup } from '$lib/planner.svelte.js';

	let { children }: { children?: import('svelte').Snippet } = $props();

	const updateNet = (): void => {
		ui.netOnline = navigator.onLine;
	};

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const login = params.get('login');
		if (login === 'ok') {
			ui.setStatus('Signed in — welcome back, rider.');
			history.replaceState(null, '', window.location.pathname);
		} else if (login === 'error') {
			const reason = params.get('reason');
			ui.setStatus(
				reason === 'denied'
					? 'Google sign-in was cancelled.'
					: reason === 'state'
						? 'Sign-in expired — please try again.'
						: 'Could not reach Google — check your connection and retry.',
				true
			);
			history.replaceState(null, '', window.location.pathname);
		}
		updateNet();
		initCloudBackup();
		window.addEventListener('online', updateNet);
		window.addEventListener('offline', updateNet);
		const mq = window.matchMedia('(max-width:640px)');
		const applyMq = () => {
			ui.isMobile = mq.matches;
		};
		applyMq();
		mq.addEventListener('change', applyMq);
		return () => {
			window.removeEventListener('online', updateNet);
			window.removeEventListener('offline', updateNet);
			mq.removeEventListener('change', applyMq);
		};
	});

	// The built src/service-worker.js is emitted as /service-worker.js by the
	// SvelteKit build — register it so the offline app shell engages. Dev has
	// no service worker build, so only register in production.
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
<OnboardingWizard />
<LegalNote />