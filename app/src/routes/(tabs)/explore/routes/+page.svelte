<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import { verdictLabel } from '$lib/verdictTheme.js';

	interface ExploreRoute {
		id: string;
		title: string;
		sport: string;
		line: [number, number][];
		created_at: string;
		rides: number;
		saves: number;
		kudos: number;
		score: number;
		fit: 'fly' | 'ok' | 'caution' | 'stop' | null;
	}

	const SEGMENTS: { label: string; href: '/explore/routes' | '/explore/crews' | '/explore/events' }[] = [
		{ label: 'Routes', href: '/explore/routes' },
		{ label: 'Crews', href: '/explore/crews' },
		{ label: 'Events', href: '/explore/events' }
	];

	let routes = $state<ExploreRoute[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	const fitTone = (fit: ExploreRoute['fit']): 'accent' | 'go' | 'caution' | 'stop' | 'neutral' => {
		if (fit === 'fly') return 'accent';
		if (fit === 'ok') return 'go';
		if (fit === 'caution') return 'caution';
		if (fit === 'stop') return 'stop';
		return 'neutral';
	};

	const fitLabel = (fit: ExploreRoute['fit']): string => (fit ? verdictLabel(fit) : 'UNRATED');

	const routeMeta = (sport: string, saves: number, rides: number): string =>
		`${sport} · ♥ ${saves} saves · ${rides} rides`;

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const res = await fetch('/api/routes/explore');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { routes: ExploreRoute[] };
			routes = data.routes;
		} catch {
			loadError = 'Could not load community routes — check your connection.';
		} finally {
			loading = false;
		}
	};

	const openRoute = (id: string): void => {
		void goto(resolve(`/route/${id}`));
	};

	onMount(() => {
		void load();
	});
</script>

<ScreenHeader title="Explore" />
<div class="explore-body">
	<SegmentedControl segments={SEGMENTS} current="/explore/routes" />
	{#if loading}
		<Skeleton lines={3} />
	{:else if loadError}
		<ErrorNotice message={loadError} onRetry={() => void load()} />
	{:else if routes.length === 0}
		<EmptyState
			title="No routes yet"
			body="Be the first — publish a ride and it will show up here for the crew."
		/>
	{:else}
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">Top lines · {routes.length}</span>
			<div class="stack">
				{#each routes as r (r.id)}
					<ListRow title={r.title} meta={routeMeta(r.sport, r.saves, r.rides)}>
						{#snippet trailing()}
							<span class="row-actions">
								<StateBadge label={fitLabel(r.fit)} tone={fitTone(r.fit)} />
								<SecondaryButton
									label="Open"
									ariaLabel="Open {r.title}"
									title="Open {r.title}"
									onclick={() => openRoute(r.id)}
								/>
							</span>
						{/snippet}
					</ListRow>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.explore-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.section-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.section-label {
		display: block;
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.stack {
		display: flex;
		flex-direction: column;
	}

	.row-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}
</style>
