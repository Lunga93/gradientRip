<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { profileSVG, MODE_ICONS } from '$lib/engine/index.js';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import { startTracking, stopTracking } from '$lib/tracker.js';
	import BattRing from '$lib/components/BattRing.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import RouteMotif from '$lib/components/RouteMotif.svelte';
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
		ui.setTab('plan');
	};
</script>

{#if domain.results}
	<div class="results relative" style="--vt: {vc};">
		{#if isStop}
			<div class="anim-stop-flash pointer-events-none absolute inset-0" aria-hidden="true"></div>
		{/if}
		<RouteMotif opacity={0.1} />
		<div class="relative">
			<div class="px-6 pt-7 pb-5">
				<span
					class="font-mono2 mb-3 block"
					style="font-size: 0.62rem; letter-spacing: 0.2em; color: var(--ink-2);"
				>
					ROUTE VERDICT
				</span>
				<div
					class="verdict-hero {isFly ? 'anim-fly' : ''}"
					style="font-size: {heroSize}; text-shadow: 0 0 40px color-mix(in srgb, {vc} 55%, transparent); margin-bottom: 10px;"
				>
					{heroLabel}
				</div>
				<div class="verdict-rule" style="margin-bottom: 10px;"></div>
				<p class="m-0 text-[0.75rem] leading-relaxed" style="color: var(--ink-1);">
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
					<div class="truncate text-[0.75rem]" style="color: var(--ink-1);">
						{domain.results.mode.label}
					</div>
					<div style="width: 52px; color: {vc};">{@html MODE_ICONS[modeId]}</div>
				</div>
			</div>

			<div class="px-6 pb-5">
				<div class="sec-label">Elevation profile</div>
				<div class="chamfer-card overflow-hidden p-3">
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
				<SlashButton label="Tweak route" variant="secondary" onclick={goPlan} />
				{#if isStop}
					<SlashButton label="Find safer route" onclick={goPlan} style="flex: 2;" />
				{:else}
					<SlashButton
						label="▶ Start ride"
						onclick={() => startTracking()}
						style="flex: 2; background: {vc}; filter: drop-shadow(0 4px 24px color-mix(in srgb, {vc} 45%, transparent));"
					/>
				{/if}
			</div>

			{#if session.trackingActive || session.trackingStats}
				<div class="px-6 pb-6">
					<div class="sec-label">Live tracking</div>
					{#if !session.trackingActive}
						<SlashButton
							label="Start live tracking"
							onclick={() => startTracking()}
							style="width: 100%;"
						/>
					{/if}
					{#if session.trackingStats}
						<div class="mt-2.5 grid grid-cols-3 gap-2">
							<div class="chamfer-card px-3 py-2 text-center">
								<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{session.trackingStats.pct}%</div>
								<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">PROGRESS</div>
							</div>
							<div class="chamfer-card px-3 py-2 text-center">
								<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{session.trackingStats.remainingKm}</div>
								<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">LEFT</div>
							</div>
							<div class="chamfer-card px-3 py-2 text-center">
								<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{session.trackingStats.acc}</div>
								<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">GPS</div>
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
						style="color: {session.trackingWarn ? 'var(--v-caution)' : 'var(--ink-2)'};"
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
