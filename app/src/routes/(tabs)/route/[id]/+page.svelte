<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';

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

	const id = $derived(page.params.id ?? '');

	let route = $state<ExploreRoute | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);

	let saving = $state(false);
	let saved = $state(false);
	let serverSaves = $state<number | null>(null);
	let saveError = $state('');

	const saves = $derived(serverSaves ?? route?.saves ?? 0);

	const fitTone = (fit: ExploreRoute['fit']): 'accent' | 'go' | 'caution' | 'stop' | 'neutral' => {
		if (fit === 'fly') return 'accent';
		if (fit === 'ok') return 'go';
		if (fit === 'caution') return 'caution';
		if (fit === 'stop') return 'stop';
		return 'neutral';
	};

	const fitLabel = (fit: ExploreRoute['fit']): string => (fit ? verdictLabel(fit) : 'UNRATED');

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const res = await fetch(`/api/routes/${encodeURIComponent(id)}`);
			if (res.status === 404) {
				route = null;
				notFound = true;
				return;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			route = (await res.json()) as ExploreRoute;
		} catch {
			route = null;
			loadError = 'Could not load this route — check your connection.';
		} finally {
			loading = false;
		}
	};

	const saveRoute = async (): Promise<void> => {
		if (saving || saved || !route) return;
		saving = true;
		saveError = '';
		try {
			const res = await fetch(`/api/routes/${route.id}/save`, { method: 'POST' });
			if (!res.ok) {
				saveError = res.status === 401 ? 'Sign in to save routes.' : 'Could not save — try again.';
				return;
			}
			const data = (await res.json()) as { saved: boolean; saves: number };
			saved = true;
			serverSaves = data.saves;
		} catch {
			saveError = 'Could not save — check your connection.';
		} finally {
			saving = false;
		}
	};

	onMount(() => {
		void load();
	});
</script>

<ScreenHeader title="Route" backHref="/explore/routes" />
<div class="detail-body">
	{#if loading && !route && !notFound}
		<Skeleton lines={3} />
	{:else if loadError && !route}
		<ErrorNotice message={loadError} onRetry={() => void load()} />
	{:else if notFound || !route}
		<EmptyState
			title="Route not found"
			body="This route may have been removed or is private."
			actionLabel="Back to routes"
			onAction={() => void goto(resolve('/explore/routes'))}
		/>
	{:else}
		<div
			class="detail-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md); --vt: {route.fit
				? verdictColor(route.fit)
				: 'var(--text-tertiary)'};"
		>
			<StateBadge label={fitLabel(route.fit)} tone={fitTone(route.fit)} />
			<h2 class="detail-title">{route.title}</h2>
			<p class="detail-meta">
				{route.sport} · {new Date(route.created_at).toLocaleDateString(undefined, {
					day: 'numeric',
					month: 'short'
				})}
			</p>
			<div class="stat-grid">
				<div
					class="stat-cell"
					style="background: var(--surface-sunken); border: 1px solid var(--line); border-radius: var(--radius-sm);"
				>
					<span class="stat-value">{route.rides}</span>
					<span class="stat-label">Rides</span>
				</div>
				<div
					class="stat-cell"
					style="background: var(--surface-sunken); border: 1px solid var(--line); border-radius: var(--radius-sm);"
				>
					<span class="stat-value">{saves}</span>
					<span class="stat-label">Saves</span>
				</div>
				<div
					class="stat-cell"
					style="background: var(--surface-sunken); border: 1px solid var(--line); border-radius: var(--radius-sm);"
				>
					<span class="stat-value">{route.kudos}</span>
					<span class="stat-label">Kudos</span>
				</div>
			</div>
			{#if saveError}
				<ErrorNotice message={saveError} />
			{/if}
			<div class="detail-actions">
				<PrimaryButton
					label={saved ? 'Saved ✓' : saving ? '…' : 'Save route'}
					ariaLabel="Save {route.title}"
					title="Save {route.title}"
					onclick={() => void saveRoute()}
				/>
			</div>
		</div>
	{/if}
</div>

<style>
	.detail-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.detail-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.detail-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.detail-meta {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
		align-self: stretch;
	}

	.stat-cell {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.125rem;
		padding: 0.625rem 0.5rem;
	}

	.stat-value {
		font: var(--type-body-strong);
		font-variant-numeric: tabular-nums;
		color: var(--text-primary);
	}

	.stat-label {
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.detail-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}
</style>
