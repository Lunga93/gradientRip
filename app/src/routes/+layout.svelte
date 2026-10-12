<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import OnboardingWizard from '$lib/components/OnboardingWizard.svelte';
	import LegalNote from '$lib/components/LegalNote.svelte';
	import { ui } from '$lib/state/ui.svelte.js';
	import { stripParams } from '$lib/ui/nav.js';
	import { initCloudBackup } from '$lib/planner.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import { feed } from '$lib/feed.svelte.js';

	let { children }: { children?: import('svelte').Snippet } = $props();

	// Post-login return target stashed by the crew page's sign-in card
	// (signed-out cold-open of /crew/<uuid>?invite=<token>). Strict shape —
	// anything else is ignored, never navigated to.
	const POST_LOGIN_TARGET_RE =
		/^\/crew\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\?invite=[0-9a-f]{1,128}$/i;

	const resumeInviteTarget = (): void => {
		let target: string | null;
		try {
			target = localStorage.getItem('post_login_target');
			localStorage.removeItem('post_login_target');
		} catch {
			return;
		}
		if (target && POST_LOGIN_TARGET_RE.test(target)) {
			// Runtime return-trip URL: regex-validated same-origin crew path,
			// not a static route, so resolve() cannot apply.
			// eslint-disable-next-line svelte/no-navigation-without-resolve -- validated /crew/<uuid>?invite=<token> return trip
			void goto(target);
		}
	};

	const updateNet = (): void => {
		ui.netOnline = navigator.onLine;
	};

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const login = params.get('login');
		if (login === 'ok') {
			ui.setStatus('Signed in — welcome back, rider.');
			history.replaceState(null, '', stripParams(window.location.href, ['login', 'reason']));
			resumeInviteTarget();
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
			history.replaceState(null, '', stripParams(window.location.href, ['login', 'reason']));
		}
		updateNet();
		initCloudBackup();
		void social.probeMe();
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

	// Live ownership (single owner): pins (/map), counts (/activity) and
	// status (/me/friends) consume live state simultaneously — starting here
	// avoids start/stop thrash on tab switches. Mirrors the legacy friends
	// logic (probeMe on mount above + start/stop here), without gating on
	// the selected tab.
	$effect(() => {
		if (social.signedIn) {
			social.startLive();
			void feed.loadNotifications();
			return () => social.stopLive();
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
<OnboardingWizard />
<LegalNote />