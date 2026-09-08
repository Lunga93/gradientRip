<script lang="ts">
	import { app } from '$lib/state/app.svelte.js';
	import { profileSVG } from '$lib/scoring.js';
	import { startTracking, stopTracking } from '$lib/tracker.js';

	const profileSvg = $derived(app.results ? profileSVG(app.results.pts, app.results.elev, app.results.cum) : '');
	const statDist = $derived(app.results ? (app.results.cum[app.results.cum.length - 1] / 1000).toFixed(1) + ' km' : '—');
	const statClimb = $derived(app.results ? app.results.totalClimb.toFixed(0) + ' m' : '—');
	const statWh = $derived(app.results ? (app.results.mode.human ? (app.results.totalWh * 0.86).toFixed(0) + ' kcal' : app.results.totalWh.toFixed(0) + ' Wh') : '—');
	const statWhK = $derived(app.results?.mode.human ? 'Effort' : 'Energy used');
	const statPctK = $derived(app.results?.mode.human ? "Of day's budget" : 'Of usable battery');
	const statPct = $derived(app.results ? ((app.results.totalWh / app.results.usableWh) * 100).toFixed(0) + '%' : '—');
</script>

{#if app.results}
	<div class="results">
		<div class="divider"></div>
		<div class="verdict {app.results.verdict.level}">
			<span class="badge">{app.results.verdict.badge}</span>
			<p>{app.results.verdict.text}</p>
		</div>
		<div class="stats">
			<div class="stat"><div class="v">{statDist}</div><div class="k">Distance</div></div>
			<div class="stat"><div class="v">{statClimb}</div><div class="k">Total climb</div></div>
			<div class="stat"><div class="v">{statWh}</div><div class="k">{statWhK}</div></div>
			<div class="stat"><div class="v">{statPct}</div><div class="k">{statPctK}</div></div>
		</div>

		<!-- tracker (was TrackerPanel.svelte) -->
		<div class="tracker">
			<button type="button" class="trackbtn" class:active={app.trackingActive}
				onclick={() => (app.trackingActive ? stopTracking() : startTracking())}>
				<svg viewBox="0 0 24 24">
					{#if app.trackingActive}<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>{:else}<path d="M8 5v14l11-7z"/>{/if}
				</svg>
				<span>{app.trackingActive ? 'Stop tracking' : 'Start live tracking'}</span>
			</button>
			{#if app.trackingStats}
				<div class="trackstats">
					<div class="stat"><div class="v">{app.trackingStats.pct}%</div><div class="k">Progress</div></div>
					<div class="stat"><div class="v">{app.trackingStats.remainingKm}</div><div class="k">Remaining</div></div>
					<div class="stat"><div class="v">{app.trackingStats.acc}</div><div class="k">GPS accuracy</div></div>
				</div>
			{/if}
			<div class="trackmsg" class:warn={app.trackingWarn} role="status" aria-live="polite">{app.trackingMsg}</div>
		</div>

		<p class="sectionlabel">Terrain profile</p>
		<svg id="profile" viewBox="0 0 900 180" preserveAspectRatio="none" role="img" aria-label="Elevation profile">
			{@html profileSvg}
		</svg>
		<div class="legend">
			<span><i style="background:#4a1420"></i>past braking</span>
			<span><i style="background:#b5502e"></i>steep descent / motor limit</span>
			<span><i style="background:#c98a2c"></i>watch your speed / hard climb</span>
			<span><i style="background:#6b8f4e"></i>easy going</span>
			<span><i style="background:#8fae7a"></i>working climb</span>
		</div>
	</div>
{/if}
