<script lang="ts">
	import { onMount } from 'svelte';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import RouteDetail, { type ExploreRoute } from '$lib/components/RouteDetail.svelte';

	let {
		lat = null,
		lon = null,
		sport = null
	}: { lat?: number | null; lon?: number | null; sport?: string | null } = $props();

	let routes = $state<ExploreRoute[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let selected = $state<ExploreRoute | null>(null);

	const fitColor = (fit: ExploreRoute['fit']): string => (fit ? verdictColor(fit) : 'var(--ink-2)');
	const fitLabel = (fit: ExploreRoute['fit']): string => (fit ? verdictLabel(fit) : 'UNRATED');

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const parts: string[] = [];
			if (lat !== null) parts.push(`lat=${encodeURIComponent(lat)}`);
			if (lon !== null) parts.push(`lon=${encodeURIComponent(lon)}`);
			if (sport) parts.push(`sport=${encodeURIComponent(sport)}`);
			const qs = parts.length > 0 ? `?${parts.join('&')}` : '';
			const res = await fetch(`/api/routes/explore${qs}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { routes: ExploreRoute[] };
			routes = data.routes;
		} catch {
			loadError = 'Could not load community routes — check your connection.';
		} finally {
			loading = false;
		}
	};

	onMount(() => {
		void load();
	});
</script>

<div class="view active p-5">
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold" style="color: var(--ink-0);">Explore</h2>
	<p class="m-0 mb-4 text-[0.8rem]" style="color: var(--ink-2);">
		Community routes ranked by popularity — save one to ride it later.
	</p>

	{#if selected}
		<RouteDetail route={selected} onBack={() => (selected = null)} />
	{:else if loading}
		<p class="text-sm" style="color: var(--ink-2);">Finding good lines…</p>
	{:else if loadError}
		<p class="m-0 text-sm font-bold" style="color: var(--color-error);" role="alert">{loadError}</p>
	{:else if routes.length === 0}
		<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
			<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">No routes yet</h3>
			<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
				Be the first — publish a ride and it will show up here for the crew.
			</p>
		</div>
	{:else}
		<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
			TOP LINES · {routes.length}
		</span>
		<div class="flex flex-col gap-2.5">
			{#each routes as r (r.id)}
				<div class="chamfer-card p-3.5" style="--vt: {fitColor(r.fit)};">
					<div class="flex items-center gap-2.5">
						<button
							type="button"
							class="min-w-0 flex-1 cursor-pointer bg-transparent text-left"
							style="border: none;"
							onclick={() => (selected = r)}
							title="Open {r.title}"
						>
							<span class="block truncate text-[0.95rem] font-bold" style="color: var(--ink-0);">
								{r.title}
							</span>
							<span class="block text-[0.7rem]" style="color: var(--ink-2);">
								{r.sport} · ♥ {r.saves} saves · {r.rides} rides
							</span>
						</button>
						<span
							class="font-mono2 shrink-0 rounded-full px-2 py-1"
							style="font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, {fitColor(r.fit)} 16%, transparent); color: {fitColor(r.fit)};"
						>
							{fitLabel(r.fit)}
						</span>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
