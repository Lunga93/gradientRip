<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { profileSVG, MODE_ICONS } from '$lib/engine/index.js';
	import { resample, RESAMPLE_STEP_M } from '$lib/util.js';
	import { nearLine, WORST_RANK, hazardIcon, type HazardKind } from '$lib/hazards.js';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import { startTracking, stopTracking } from '$lib/tracker.js';
	import BattRing from '$lib/components/BattRing.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import Mark from '$lib/components/Mark.svelte';

	const profileChart = $derived(
		domain.results
			? profileSVG(domain.results.pts, domain.results.elev, domain.results.cum, {
					climb: domain.results.climbLimit
				})
			: null
	);
	const level = $derived(domain.results?.verdict.level ?? 'ok');
	const vc = $derived(verdictColor(level));
	const heroLabel = $derived(domain.results ? verdictLabel(level) : '');
	const isStop = $derived(level === 'stop');
	const isFly = $derived(level === 'fly');

	const distKm = $derived(
		domain.results ? domain.results.cum[domain.results.cum.length - 1] / 1000 : 0
	);
	const climbM = $derived(domain.results?.totalClimb ?? 0);
	const human = $derived(domain.results?.mode.human ?? false);
	const energyVal = $derived(
		domain.results ? (human ? domain.results.totalWh * 0.86 : domain.results.totalWh) : 0
	);
	const energyUnit = $derived(human ? 'kcal' : 'Wh');
	const usedPct = $derived(
		domain.results ? (domain.results.totalWh / domain.results.usableWh) * 100 : 0
	);
	const battLeft = $derived(Math.max(0, 100 - usedPct));

	const heroSize = $derived(
		level === 'fly'
			? 'clamp(2.4rem, 13vw, 3.4rem)'
			: level === 'caution'
				? 'clamp(2.6rem, 15vw, 3.75rem)'
				: 'clamp(3.4rem, 22vw, 5.5rem)'
	);

	const modeId = $derived(MODE_ICONS[domain.modeId] ? domain.modeId : 'eskate');

	const goPlan = (): void => {
		void goto(resolve('/map'));
	};

	// Planner hazard warning: the scored line is fresh (not a saved route), so
	// the known pins come from open-route hazards on explore routes. Reads are
	// anonymous-safe (Task 2 bundling has no requireAuth); the 200 m corridor
	// check runs client-side over the resampled line vertices via nearLine.
	// Advisory only — a failed check shows no strip, never blocks the results.
	interface WarnPin {
		key: string;
		kind: string;
		confirmations: number;
	}

	const HAZARD_CORRIDOR_M = 200;

	let hazardWarnings = $state<WarnPin[]>([]);
	let hazardReady = $state(false);

	const hazardRank = (kind: string): number =>
		(kind as HazardKind) in WORST_RANK ? WORST_RANK[kind as HazardKind] : 99;

	$effect(() => {
		const results = domain.results;
		if (!results || results.line.length < 2) {
			hazardWarnings = [];
			hazardReady = false;
			return;
		}
		let cancelled = false;
		hazardWarnings = [];
		hazardReady = false;
		void (async () => {
			try {
				const vertices = resample(results.line, RESAMPLE_STEP_M);
				const ex = await fetch('/api/routes/explore');
				if (!ex.ok || cancelled) return;
				const data = (await ex.json()) as {
					routes: { id: string; hazard_count?: number }[];
				};
				const withHazards = (data.routes ?? [])
					.filter((r) => (r.hazard_count ?? 0) > 0)
					.slice(0, 10);
				const found: WarnPin[] = [];
				for (const r of withHazards) {
					if (cancelled) return;
					const dr = await fetch(`/api/routes/${encodeURIComponent(r.id)}`);
					if (!dr.ok) continue;
					const detail = (await dr.json()) as {
						hazards?: {
							id: string;
							kind: string;
							lat: number | null;
							lon: number | null;
							confirmations: number;
						}[];
					};
					for (const h of detail.hazards ?? []) {
						if (h.lat === null || h.lon === null) continue;
						if (nearLine([h.lat, h.lon], vertices, HAZARD_CORRIDOR_M)) {
							found.push({
								key: `${r.id}:${h.id}`,
								kind: h.kind,
								confirmations: h.confirmations ?? 0
							});
						}
					}
				}
				if (cancelled) return;
				found.sort((a, b) => hazardRank(a.kind) - hazardRank(b.kind));
				hazardWarnings = found;
				hazardReady = true;
			} catch {
				if (!cancelled) hazardReady = true;
			}
		})();
		return () => {
			cancelled = true;
		};
	});
</script>

{#if domain.results}
	<div class="results relative" style="--vt: {vc};">
		{#if isStop}
			<div class="anim-stop-flash pointer-events-none absolute inset-0" aria-hidden="true"></div>
		{/if}
		<div class="relative">
			<div class="px-6 pt-7 pb-5">
			<span style="display: block; margin-bottom: 0.75rem; font: var(--type-label); letter-spacing: 0.16em; color: var(--text-tertiary);">
				ROUTE VERDICT
			</span>
				<div
					class="verdict-hero {isFly ? 'anim-fly' : ''}"
					style="font-size: {heroSize}; text-shadow: 0 0 40px color-mix(in srgb, {vc} 55%, transparent); margin-bottom: 10px;"
				>
					{heroLabel}
				</div>
				<div class="verdict-rule" style="margin-bottom: 10px;"></div>
			<p class="m-0 text-[0.75rem] leading-relaxed" style="color: var(--text-secondary);">
				{domain.results.verdict.text}
			</p>
			</div>

			{#if hazardReady && hazardWarnings.length > 0}
				<div class="px-6 pb-5">
					<div
						class="hazard-strip"
						role="status"
						aria-live="polite"
						style="background: color-mix(in srgb, #f59e0b 10%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 40%, transparent); border-radius: 8px;"
					>
						<strong class="hazard-strip-title">⚠ Hazards reported near this route</strong>
						{#each hazardWarnings as w (w.key)}
							<span class="hazard-strip-item"
								>{hazardIcon(w.kind)} {w.kind} · {w.confirmations} confirm{w.confirmations === 1 ? '' : 's'}</span
							>
						{/each}
					</div>
				</div>
			{/if}

			{#if !session.planning}
				<div class="grid grid-cols-2 gap-x-4 gap-y-4 px-6 pb-5">
					<div class="stat-block stat-block-hot animation-rise">
						<span class="k">DISTANCE</span>
						<span class="v">{distKm.toFixed(1)}<small>km</small></span>
					</div>
					<div class="stat-block animation-rise">
						<span class="k">TOTAL CLIMB</span>
						<span class="v">+{climbM.toFixed(0)}<small>m</small></span>
					</div>
					<div class="stat-block stat-block-hot animation-rise">
						<span class="k">{human ? 'EFFORT' : 'ENERGY USED'}</span>
						<span class="v" style="color: {vc};">{energyVal.toFixed(0)}<small>{energyUnit}</small></span>
					</div>
					<div class="stat-block animation-rise">
						<span class="k">{human ? "OF DAY'S BUDGET" : 'BATTERY USED'}</span>
						<span class="v" style={isStop ? `color: ${vc};` : ''}>{usedPct.toFixed(0)}<small>%</small></span>
					</div>
				</div>
			{/if}

			<div class="flex items-center gap-4 px-6 pb-5">
				<BattRing pct={battLeft} color={vc} size={76} />
			<div class="min-w-0">
				<div class="truncate text-[0.75rem]" style="color: var(--text-secondary);">
					{domain.results.mode.label}
				</div>
					<div style="width: 52px; color: {vc};">{@html MODE_ICONS[modeId]}</div>
				</div>
			</div>

			<div class="px-6 pb-5">
		<div style="font: var(--type-label); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 0.625rem;">Elevation profile</div>
			<div class="overflow-hidden p-3" style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);">
					{#if profileChart}
						<div class="profile-chart">
							<div class="profile-yaxis" aria-hidden="true">
								{#each profileChart.yTicks as t (t.label)}
									<span style="top: {t.pct}%">{t.label}</span>
								{/each}
							</div>
							<div class="profile-body">
								<svg
									id="profile"
									viewBox="0 0 900 200"
									preserveAspectRatio="none"
									role="img"
									aria-label="Elevation profile"
								>
									{@html profileChart.svg}
								</svg>
								<div class="profile-xaxis" aria-hidden="true">
									{#each profileChart.xTicks as t, i (t.label)}
										<span
											class:first={i === 0}
											class:last={i === profileChart.xTicks.length - 1}
											style="left: {t.pct}%">{t.label}</span
										>
									{/each}
								</div>
							</div>
						</div>
					{/if}
				</div>
				<div class="mt-2.5 flex flex-wrap gap-1.5">
					<span class="legend-chip"><i style="background: var(--band-stop);"></i>past braking</span>
					<span class="legend-chip"><i style="background: var(--band-steepd);"></i>steep / limit</span>
					<span class="legend-chip"><i style="background: var(--band-watch);"></i>watch / hard</span>
					<span class="legend-chip"><i style="background: var(--band-easy);"></i>easy</span>
					<span class="legend-chip"><i style="background: var(--band-work);"></i>working</span>
				</div>
			</div>

			<div class="mt-auto flex gap-2 px-6 pb-6">
				<SecondaryButton label="Tweak route" onclick={goPlan} />
				<div style="flex: 2; display: grid;">
					{#if isStop}
						<PrimaryButton label="Find safer route" onclick={goPlan} />
					{:else}
						<PrimaryButton label="▶ Start ride" onclick={() => startTracking()} />
					{/if}
				</div>
			</div>

			{#if session.trackingActive || session.trackingStats}
			<div class="px-6 pb-6">
				<div style="font: var(--type-label); letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-tertiary); margin-bottom: 0.625rem;">Live tracking</div>
				{#if !session.trackingActive}
					<div style="display: grid;">
						<SecondaryButton label="Start live tracking" onclick={() => startTracking()} />
					</div>
				{/if}
				{#if session.trackingStats}
					<div class="mt-2.5 grid grid-cols-3 gap-2">
						<div class="px-3 py-2 text-center" style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);">
							<div class="font-display text-sm font-bold tabular-nums" style="color: var(--text-primary);">{session.trackingStats.pct}%</div>
							<div style="font: var(--type-label); color: var(--text-tertiary);">PROGRESS</div>
						</div>
						<div class="px-3 py-2 text-center" style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);">
							<div class="font-display text-sm font-bold tabular-nums" style="color: var(--text-primary);">{session.trackingStats.remainingKm}</div>
							<div style="font: var(--type-label); color: var(--text-tertiary);">LEFT</div>
						</div>
						<div class="px-3 py-2 text-center" style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);">
							<div class="font-display text-sm font-bold tabular-nums" style="color: var(--text-primary);">{session.trackingStats.acc}</div>
							<div style="font: var(--type-label); color: var(--text-tertiary);">GPS</div>
						</div>
					</div>
						<div
							class="mt-2 h-1.5 overflow-hidden"
							style="background: var(--panel-line); border-radius: 2px;"
							role="progressbar"
							aria-valuenow={session.trackingStats.pct}
							aria-valuemin="0"
							aria-valuemax="100"
							aria-label="Route progress"
						>
							<div
								style="width: {session.trackingStats.pct}%; height: 100%; background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); box-shadow: 0 0 8px var(--brand-glow);"
							></div>
						</div>
					{/if}
					<div
						class="mt-2 min-h-[1.1em] text-[0.75rem]"
						style="color: {session.trackingWarn ? 'var(--v-caution)' : 'var(--text-tertiary)'};"
						role="status"
						aria-live="polite"
					>
						{session.trackingMsg}
					</div>
					{#if session.trackingActive}
						<button
							type="button"
							class="board-chip mt-1 w-full"
							onclick={() => stopTracking()}
							title="Stop GPS tracking"
						>
							<span class="inline-flex items-center gap-1.5"><Mark name="stop" cls="size-3" />STOP TRACKING</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.hazard-strip {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.75rem;
	}

	.hazard-strip-title {
		font-size: 0.8rem;
		font-weight: 700;
		color: #fbbf24;
	}

	.hazard-strip-item {
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text-primary);
		text-transform: capitalize;
	}
</style>
