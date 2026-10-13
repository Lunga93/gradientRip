<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import RouteMiniMap from '$lib/components/RouteMiniMap.svelte';
	import type { MiniMapPin } from '$lib/components/RouteMiniMap.svelte';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import { relTime } from '$lib/ui/format.js';
	import { HAZARD_KINDS, hazardIcon, type HazardKind } from '$lib/hazards.js';

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

	interface RouteHazard {
		id: string;
		kind: string;
		lat: number | null;
		lon: number | null;
		note: string | null;
		confirmations: number;
		reporter_name: string | null;
		created_at: string;
		expires_at: string;
		age_days: number;
	}

	const id = $derived(page.params.id ?? '');

	let route = $state<ExploreRoute | null>(null);
	let hazards = $state<RouteHazard[]>([]);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);

	let me = $state<string | null>(null);

	let saving = $state(false);
	let saved = $state(false);
	let serverSaves = $state<number | null>(null);
	let saveError = $state('');

	// Report flow state (kind picker → optional pin-drop → note → expiry → submit).
	let showReport = $state(false);
	let reportKind = $state<HazardKind | null>(null);
	let reportNote = $state('');
	let reportExpiry = $state<7 | 30>(30);
	let picking = $state(false);
	let picked = $state<[number, number] | null>(null);
	let submitting = $state(false);
	let formError = $state('');
	let formOk = $state('');

	// Per-hazard action state: busy id + inline row message.
	let rowBusy = $state<string | null>(null);
	let rowMsg = $state<Record<string, string>>({});

	const saves = $derived(serverSaves ?? route?.saves ?? 0);

	const pins = $derived<MiniMapPin[]>(
		hazards
			.filter((h) => h.lat !== null && h.lon !== null)
			.map((h) => ({
				lat: h.lat as number,
				lon: h.lon as number,
				kind: h.kind,
				label: `${h.kind} · ${h.confirmations} confirm${h.confirmations === 1 ? '' : 's'}`
			}))
	);

	const hazardAge = (h: RouteHazard): string => {
		const ts = new Date(h.created_at).getTime();
		return Number.isFinite(ts) ? relTime(ts) : '';
	};

	const fitTone = (fit: ExploreRoute['fit']): 'accent' | 'go' | 'caution' | 'stop' | 'neutral' => {
		if (fit === 'fly') return 'accent';
		if (fit === 'ok') return 'go';
		if (fit === 'caution') return 'caution';
		if (fit === 'stop') return 'stop';
		return 'neutral';
	};

	const fitLabel = (fit: ExploreRoute['fit']): string => (fit ? verdictLabel(fit) : 'UNRATED');

	const errMsg = async (res: Response, fallback: string): Promise<string> => {
		try {
			const data = (await res.json()) as { message?: string };
			return typeof data.message === 'string' && data.message ? data.message : fallback;
		} catch {
			return fallback;
		}
	};

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		notFound = false;
		try {
			const res = await fetch(`/api/routes/${encodeURIComponent(id)}`);
			if (res.status === 404) {
				route = null;
				hazards = [];
				notFound = true;
				return;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as ExploreRoute & { hazards?: RouteHazard[] };
			route = data;
			hazards = Array.isArray(data.hazards) ? data.hazards : [];
		} catch {
			route = null;
			hazards = [];
			loadError = 'Could not load this route — check your connection.';
		} finally {
			loading = false;
		}
	};

	const loadMe = async (): Promise<void> => {
		try {
			const res = await fetch('/api/auth/me');
			if (!res.ok) return;
			const data = (await res.json()) as { user: { id: string } | null };
			me = data.user?.id ?? null;
		} catch {
			me = null;
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

	const submitReport = async (): Promise<void> => {
		if (submitting || !route) return;
		formError = '';
		formOk = '';
		if (!reportKind) {
			formError = 'Pick a hazard kind.';
			return;
		}
		if (reportNote.trim().length > 280) {
			formError = 'Note must be 280 chars or fewer.';
			return;
		}
		submitting = true;
		try {
			const res = await fetch(`/api/routes/${route.id}/hazards`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					kind: reportKind,
					lat: picked?.[0] ?? null,
					lon: picked?.[1] ?? null,
					note: reportNote.trim() ? reportNote.trim() : null,
					expires_days: reportExpiry
				})
			});
			if (!res.ok) {
				formError =
					res.status === 401
						? 'Sign in to report hazards.'
						: await errMsg(res, 'Could not report — try again.');
				return;
			}
			formOk = 'Hazard reported.';
			showReport = false;
			reportKind = null;
			reportNote = '';
			reportExpiry = 30;
			picking = false;
			picked = null;
			await load();
		} catch {
			formError = 'Could not report — check your connection.';
		} finally {
			submitting = false;
		}
	};

	const confirmHazard = async (hazardId: string): Promise<void> => {
		if (rowBusy) return;
		rowBusy = hazardId;
		rowMsg = { ...rowMsg, [hazardId]: '' };
		try {
			const res = await fetch(`/api/hazards/${hazardId}/confirm`, { method: 'POST' });
			if (!res.ok) {
				rowMsg = {
					...rowMsg,
					[hazardId]:
						res.status === 409
							? 'You already confirmed this hazard.'
							: res.status === 401
								? 'Sign in to confirm hazards.'
								: await errMsg(res, 'Could not confirm — try again.')
				};
				return;
			}
			const data = (await res.json()) as { confirmations: number; capped: boolean };
			hazards = hazards.map((h) =>
				h.id === hazardId ? { ...h, confirmations: data.confirmations } : h
			);
			rowMsg = {
				...rowMsg,
				[hazardId]: data.capped
					? 'Still there — expiry is at the 90-day cap.'
					: 'Still there — expiry extended 7 days.'
			};
		} catch {
			rowMsg = { ...rowMsg, [hazardId]: 'Could not confirm — check your connection.' };
		} finally {
			rowBusy = null;
		}
	};

	const resolveHazard = async (hazardId: string): Promise<void> => {
		if (rowBusy) return;
		rowBusy = hazardId;
		rowMsg = { ...rowMsg, [hazardId]: '' };
		try {
			const res = await fetch(`/api/hazards/${hazardId}/resolve`, { method: 'POST' });
			if (!res.ok) {
				rowMsg = {
					...rowMsg,
					[hazardId]:
						res.status === 403
							? 'Only the reporter or the route author can resolve this hazard.'
							: res.status === 401
								? 'Sign in to resolve hazards.'
								: await errMsg(res, 'Could not resolve — try again.')
				};
				return;
			}
			hazards = hazards.filter((h) => h.id !== hazardId);
		} catch {
			rowMsg = { ...rowMsg, [hazardId]: 'Could not resolve — check your connection.' };
		} finally {
			rowBusy = null;
		}
	};

	onMount(() => {
		void load();
		void loadMe();
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
				<SecondaryButton
					label={showReport ? 'Close report' : 'Report hazard'}
					ariaLabel="Report a hazard on {route.title}"
					title="Report a hazard on {route.title}"
					onclick={() => {
						showReport = !showReport;
						formError = '';
						formOk = '';
					}}
				/>
			</div>
		</div>

		<div
			class="detail-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">Route map · {hazards.length} open hazard{hazards.length === 1 ? '' : 's'}</span>
			<RouteMiniMap
				line={route.line}
				{pins}
				{picking}
				{picked}
				onPick={(ll) => {
					picked = ll;
					picking = false;
				}}
			/>
			{#if picking}
				<p class="hint">Tap the map to drop the hazard pin.</p>
			{/if}
		</div>

		{#if showReport}
			<div
				class="detail-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Report a hazard</span>
				{#if !me}
					<p class="hint">Sign in to report a hazard.</p>
				{:else}
					<div class="kind-grid" role="group" aria-label="Hazard kind">
						{#each HAZARD_KINDS as kind (kind)}
							<SecondaryButton
								label="{hazardIcon(kind)} {kind}"
								ariaLabel="Report {kind}"
								title="Report {kind}"
								ariaPressed={reportKind === kind}
								onclick={() => {
									reportKind = kind;
								}}
							/>
						{/each}
					</div>
					<div class="pin-row">
						<SecondaryButton
							label={picking ? 'Tap the map…' : picked ? 'Move pin' : 'Drop pin on map'}
							ariaLabel={picked ? 'Move the hazard pin' : 'Drop a hazard pin on the map'}
							title={picked ? 'Move the hazard pin' : 'Drop a hazard pin on the map'}
							onclick={() => {
								picking = !picking;
							}}
						/>
						{#if picked}
							<span class="pin-coords"
								>Pin: {picked[0].toFixed(5)}, {picked[1].toFixed(5)}</span
							>
							<SecondaryButton
								label="Clear"
								ariaLabel="Clear the hazard pin"
								title="Clear the hazard pin"
								onclick={() => {
									picked = null;
									picking = false;
								}}
							/>
						{:else}
							<span class="pin-coords">No pin — reported route-wide.</span>
						{/if}
					</div>
					<label class="field-label" for="hazard-note">Note (optional, 280 chars)</label>
					<textarea
						id="hazard-note"
						class="note-input"
						rows="2"
						maxlength={280}
						placeholder="What should riders watch for?"
						bind:value={reportNote}
					></textarea>
					<div class="expiry-row" role="group" aria-label="Hazard expiry">
						<SecondaryButton
							label="Expires in 7 days"
							ariaLabel="Hazard expires in 7 days"
							title="Hazard expires in 7 days"
							ariaPressed={reportExpiry === 7}
							onclick={() => {
								reportExpiry = 7;
							}}
						/>
						<SecondaryButton
							label="Expires in 30 days"
							ariaLabel="Hazard expires in 30 days"
							title="Hazard expires in 30 days"
							ariaPressed={reportExpiry === 30}
							onclick={() => {
								reportExpiry = 30;
							}}
						/>
					</div>
					{#if formError}
						<ErrorNotice message={formError} />
					{/if}
					{#if formOk}
						<p class="ok-msg" role="status">{formOk}</p>
					{/if}
					<div class="detail-actions">
						<PrimaryButton
							label={submitting ? '…' : 'Submit report'}
							ariaLabel="Submit hazard report"
							title="Submit hazard report"
							onclick={() => void submitReport()}
						/>
					</div>
				{/if}
			</div>
		{/if}

		<div
			class="detail-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">Open hazards · {hazards.length}</span>
			{#if hazards.length === 0}
				<p class="hint">No open hazards reported on this route.</p>
			{:else}
				<div class="hazard-list">
					{#each hazards as h (h.id)}
						<div class="hazard-row">
							<span class="hazard-icon" aria-hidden="true">{hazardIcon(h.kind)}</span>
							<div class="hazard-body">
								<div class="hazard-title">
									<strong>{h.kind}</strong>
									<span class="hazard-meta">· {h.confirmations} confirm{h.confirmations === 1 ? '' : 's'} · {hazardAge(h)}</span>
								</div>
								{#if h.note}
									<p class="hazard-note">{h.note}</p>
								{/if}
								{#if h.reporter_name}
									<p class="hazard-reporter">Reported by {h.reporter_name}</p>
								{/if}
								{#if rowMsg[h.id]}
									<p class="hazard-msg" role="status">{rowMsg[h.id]}</p>
								{/if}
								{#if me}
									<div class="hazard-actions">
										<SecondaryButton
											label={rowBusy === h.id ? '…' : 'Still there'}
											ariaLabel="Confirm {h.kind} is still there"
											title="Confirm {h.kind} is still there"
											onclick={() => void confirmHazard(h.id)}
										/>
										<SecondaryButton
											label={rowBusy === h.id ? '…' : 'Resolve'}
											ariaLabel="Resolve {h.kind}"
											title="Resolve {h.kind}"
											onclick={() => void resolveHazard(h.id)}
										/>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
				{#if !me}
					<p class="hint">Sign in to confirm or resolve hazards.</p>
				{/if}
			{/if}
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

	.section-label {
		display: block;
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.ok-msg {
		margin: 0;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--v-go, #22c55e);
	}

	.kind-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		align-self: stretch;
	}

	.pin-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		align-self: stretch;
	}

	.pin-coords {
		font-size: 0.75rem;
		font-variant-numeric: tabular-nums;
		color: var(--text-secondary);
	}

	.field-label {
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.note-input {
		align-self: stretch;
		min-height: 44px;
		padding: 0.625rem 0.75rem;
		font-size: 0.85rem;
		color: var(--text-primary);
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		resize: vertical;
	}

	.expiry-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.hazard-list {
		display: flex;
		flex-direction: column;
		align-self: stretch;
	}

	.hazard-row {
		display: flex;
		gap: 0.625rem;
		padding: 0.625rem 0;
		border-bottom: 1px solid var(--line);
	}

	.hazard-row:last-child {
		border-bottom: none;
	}

	.hazard-icon {
		flex-shrink: 0;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: #1b2125;
		border: 2px solid #f59e0b;
		color: #fbbf24;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		line-height: 1;
	}

	.hazard-body {
		flex: 1 1 auto;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
	}

	.hazard-title {
		font-size: 0.85rem;
		color: var(--text-primary);
	}

	.hazard-title strong {
		text-transform: capitalize;
	}

	.hazard-meta {
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.hazard-note {
		margin: 0;
		font-size: 0.8rem;
		line-height: 1.5;
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.hazard-reporter {
		margin: 0;
		font-size: 0.7rem;
		color: var(--text-tertiary);
	}

	.hazard-msg {
		margin: 0;
		font-size: 0.75rem;
		color: var(--text-secondary);
	}

	.hazard-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}
</style>
