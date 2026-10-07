<script lang="ts">
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';

	export interface RidePick {
		kind: 'trip' | 'route';
		id: number | string;
		label: string;
	}

	// pg serialises bigint/numeric as strings — coerce before display or submit.
	interface TripRow {
		id: number | string;
		ts: number | string;
		total_km: number | string | null;
		mode_id?: string | null;
	}

	interface ExploreRoute {
		id: string;
		title: string;
		sport: string;
	}

	let {
		selected,
		onselect,
		onclear
	}: {
		selected: RidePick | null;
		onselect: (ride: RidePick) => void;
		onclear: () => void;
	} = $props();

	let trips = $state<TripRow[]>([]);
	let routes = $state<ExploreRoute[]>([]);
	let loading = $state(true);
	let loadError = $state('');

	const radioValue = (ride: RidePick): string => `${ride.kind}:${String(ride.id)}`;
	const selectedValue = $derived(selected ? radioValue(selected) : '');

	const tripLabel = (t: TripRow): string => {
		const date = new Date(Number(t.ts)).toLocaleDateString(undefined, {
			day: 'numeric',
			month: 'short'
		});
		const km = t.total_km === null ? null : Number(t.total_km);
		return km === null || !Number.isFinite(km) ? `Ride · ${date}` : `Ride · ${km.toFixed(1)} km · ${date}`;
	};

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const [tripsRes, routesRes] = await Promise.all([
				fetch('/api/trips?limit=20'),
				fetch('/api/routes/explore')
			]);
			if (tripsRes.status === 401 || routesRes.status === 401) {
				throw new Error('Sign in to attach a ride.');
			}
			if (!tripsRes.ok || !routesRes.ok) throw new Error('fetch failed');
			const tripRows = (await tripsRes.json()) as TripRow[];
			const routeData = (await routesRes.json()) as { routes: ExploreRoute[] };
			trips = Array.isArray(tripRows) ? tripRows : [];
			routes = Array.isArray(routeData.routes) ? routeData.routes : [];
		} catch {
			loadError = 'Could not load rides — check your connection.';
		} finally {
			loading = false;
		}
	};

	const pickTrip = (t: TripRow): void => {
		const id = Number(t.id);
		if (!Number.isInteger(id) || id <= 0) return;
		onselect({ kind: 'trip', id, label: tripLabel(t) });
	};
	const pickRoute = (r: ExploreRoute): void =>
		onselect({ kind: 'route', id: r.id, label: `${r.title} · ${r.sport}` });

	$effect(() => {
		void load();
	});
</script>

<section class="picker" aria-label="Attach a ride">
	<div class="picker-head">
		<h2 class="picker-title">Attach a ride</h2>
		{#if selected}
			<SecondaryButton
				label="Clear"
				ariaLabel="Remove attached ride"
				title="Remove attached ride"
				onclick={onclear}
			/>
		{/if}
	</div>
	{#if loading}
		<Skeleton lines={3} />
	{:else if loadError}
		<ErrorNotice message={loadError} onRetry={() => void load()} />
	{:else}
		{#if selected}
			<p class="picker-selected" role="status">Attached: {selected.label}</p>
		{/if}
		<h3 class="picker-section">My trips</h3>
		{#if trips.length === 0}
			<p class="picker-empty">No saved trips yet.</p>
		{:else}
			<ul class="picker-list">
				{#each trips as t (t.id)}
					<li>
						<label class="picker-row">
							<input
								type="radio"
								name="ride-pick"
								value={radioValue({ kind: 'trip', id: t.id, label: '' })}
								checked={selectedValue === `trip:${t.id}`}
								onchange={() => pickTrip(t)}
							/>
							<span class="picker-label">{tripLabel(t)}</span>
						</label>
					</li>
				{/each}
			</ul>
		{/if}
		<h3 class="picker-section">Public routes</h3>
		{#if routes.length === 0}
			<p class="picker-empty">No public routes yet.</p>
		{:else}
			<ul class="picker-list">
				{#each routes as r (r.id)}
					<li>
						<label class="picker-row">
							<input
								type="radio"
								name="ride-pick"
								value={radioValue({ kind: 'route', id: r.id, label: '' })}
								checked={selectedValue === `route:${r.id}`}
								onchange={() => pickRoute(r)}
							/>
							<span class="picker-label">{r.title} · {r.sport}</span>
						</label>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
	}

	.picker-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.picker-title {
		margin: 0;
		font: var(--type-body-strong);
		color: var(--text-primary);
	}

	.picker-selected {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.picker-section {
		margin: 0.5rem 0 0;
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}

	.picker-empty {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.picker-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-height: 12rem;
		overflow-y: auto;
	}

	.picker-row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		min-height: 44px;
		padding: 0.375rem 0.5rem;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.picker-row:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.picker-row input {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		accent-color: var(--accent);
	}

	.picker-label {
		font: var(--type-body);
		color: var(--text-primary);
	}
</style>
