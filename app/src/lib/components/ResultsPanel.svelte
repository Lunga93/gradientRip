<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { profileSVG } from '$lib/engine/scoring.js';
	import { startTracking, stopTracking } from '$lib/tracker.js';

	const profileSvg = $derived(domain.results ? profileSVG(domain.results.pts, domain.results.elev, domain.results.cum) : '');
	const statDist = $derived(domain.results ? (domain.results.cum[domain.results.cum.length - 1] / 1000).toFixed(1) + ' km' : '—');
	const statClimb = $derived(domain.results ? domain.results.totalClimb.toFixed(0) + ' m' : '—');
	const statWh = $derived(domain.results ? (domain.results.mode.human ? (domain.results.totalWh * 0.86).toFixed(0) + ' kcal' : domain.results.totalWh.toFixed(0) + ' Wh') : '—');
	const statWhK = $derived(domain.results?.mode.human ? 'Effort' : 'Energy used');
	const statPctK = $derived(domain.results?.mode.human ? "Of day's budget" : 'Of usable battery');
	const statPct = $derived(domain.results ? ((domain.results.totalWh / domain.results.usableWh) * 100).toFixed(0) + '%' : '—');
	const verdictCls = $derived(
		domain.results?.verdict.level === 'ok' ? 'alert-success' : domain.results?.verdict.level === 'caution' ? 'alert-warning' : 'alert-error'
	);
</script>

{#if domain.results}
	<div class="results">
		<div class="alert {verdictCls} items-start shadow-none">
			<svg viewBox="0 0 24 24" class="mt-0.5 size-5 shrink-0 fill-current">
				{#if domain.results.verdict.level === 'ok'}<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm-1.2 14.6l-4-4 1.4-1.4 2.6 2.6 5.6-5.6 1.4 1.4-7 7z" />
				{:else if domain.results.verdict.level === 'caution'}<path d="M12 2 1 21h22L12 2zm1 14h-2v2h2v-2zm0-8h-2v5h2V8z" />
				{:else}<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />{/if}
			</svg>
			<div>
				<span class="badge badge-sm badge-ghost font-bold tracking-wide">{domain.results.verdict.badge}</span>
				<p class="mt-1 text-[0.84rem] leading-relaxed">{domain.results.verdict.text}</p>
			</div>
		</div>

		{#if !session.planning}
			<div class="mt-3 grid grid-cols-2 gap-2">
				<div class="stat animation-rise rounded-2xl border border-base-300 bg-base-200 py-3">
					<div class="stat-title text-[0.68rem]">Distance</div>
					<div class="stat-value text-lg tabular-nums">{statDist}</div>
				</div>
				<div class="stat animation-rise rounded-2xl border border-base-300 bg-base-200 py-3">
					<div class="stat-title text-[0.68rem]">Total climb</div>
					<div class="stat-value text-lg tabular-nums">{statClimb}</div>
				</div>
				<div class="stat animation-rise rounded-2xl border border-base-300 bg-base-200 py-3">
					<div class="stat-title text-[0.68rem]">{statWhK}</div>
					<div class="stat-value text-lg tabular-nums">{statWh}</div>
				</div>
				<div class="stat animation-rise rounded-2xl border border-base-300 bg-base-200 py-3">
					<div class="stat-title text-[0.68rem]">{statPctK}</div>
					<div class="stat-value text-lg tabular-nums">{statPct}</div>
				</div>
			</div>
		{/if}

		<!-- tracker -->
		<div class="mt-3">
			<button
				type="button"
				class="btn {session.trackingActive ? 'btn-outline' : 'btn-primary'} w-full"
				onclick={() => (session.trackingActive ? stopTracking() : startTracking())}
			>
				<svg viewBox="0 0 24 24" class="size-4 fill-current">
					{#if session.trackingActive}<path d="M6 5h4v14H6zM14 5h4v14h-4z" />{:else}<path d="M8 5v14l11-7z" />{/if}
				</svg>
				<span>{session.trackingActive ? 'Stop tracking' : 'Start live tracking'}</span>
			</button>
			{#if session.trackingStats}
				<div class="mt-2 grid grid-cols-3 gap-2">
					<div class="stat rounded-xl border border-base-300 bg-base-200 px-3 py-2">
						<div class="stat-value text-sm tabular-nums">{session.trackingStats.pct}%</div>
						<div class="stat-title text-[0.64rem]">Progress</div>
					</div>
					<div class="stat rounded-xl border border-base-300 bg-base-200 px-3 py-2">
						<div class="stat-value text-sm tabular-nums">{session.trackingStats.remainingKm}</div>
						<div class="stat-title text-[0.64rem]">Remaining</div>
					</div>
					<div class="stat rounded-xl border border-base-300 bg-base-200 px-3 py-2">
						<div class="stat-value text-sm tabular-nums">{session.trackingStats.acc}</div>
						<div class="stat-title text-[0.64rem]">GPS accuracy</div>
					</div>
				</div>
				<progress class="progress progress-primary mt-2 h-1.5" value={session.trackingStats.pct} max="100" aria-label="Route progress"></progress>
			{/if}
			<div
				class="mt-2 min-h-[1.1em] text-[0.75rem] {session.trackingWarn ? 'text-warning' : 'text-base-content/55'}"
				role="status"
				aria-live="polite"
			>{session.trackingMsg}</div>
		</div>

		<h3 class="mt-4 mb-2 flex items-center gap-2 text-[0.72rem] font-semibold tracking-wide text-base-content/60">
			Terrain profile
			<span class="h-px flex-1 bg-base-300"></span>
		</h3>
		<svg
			id="profile"
			viewBox="0 0 900 180"
			preserveAspectRatio="none"
			role="img"
			aria-label="Elevation profile"
			class="border border-base-300 bg-base-200"
		>
			{@html profileSvg}
		</svg>
		<div class="mt-2.5 flex flex-wrap gap-2">
			<span class="legend-chip"><i style="background:var(--band-stop, #4a1420)"></i>past braking</span>
			<span class="legend-chip"><i style="background:var(--band-steepd, #b5502e)"></i>steep descent / motor limit</span>
			<span class="legend-chip"><i style="background:var(--band-watch, #c98a2c)"></i>watch your speed / hard climb</span>
			<span class="legend-chip"><i style="background:var(--band-easy, #6b8f4e)"></i>easy going</span>
			<span class="legend-chip"><i style="background:var(--band-work, #8fae7a)"></i>working climb</span>
		</div>
	</div>
{/if}