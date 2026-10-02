<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { profileSVG, MODE_ICONS } from '$lib/engine/index.js';
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
						<PrimaryButton label="Start live tracking" onclick={() => startTracking()} />
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
