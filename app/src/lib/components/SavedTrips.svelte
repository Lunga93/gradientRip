<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { MODES, decide, routeSegments } from '$lib/engine/index.js';
	import { cumulative } from '$lib/util.js';
	import type { LatLon } from '$lib/util.js';
	import { loadTrip } from '$lib/planner.svelte.js';
	import type { Trip } from '$lib/storage.js';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import BattRing from '$lib/components/BattRing.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import Mark from '$lib/components/Mark.svelte';

	const tripLabel = (t: Trip): string => t.queries.join(' → ');

	const tripType = (t: Trip): string => (t.recorded ? 'Recorded' : t.drawn ? 'Drawn' : 'Planned');

	const tripDay = (ts: number): string => {
		const d = new Date(ts);
		const now = new Date();
		const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const diff = Math.round((today - day) / 86400000);
		if (diff <= 0) return 'Today';
		if (diff === 1) return 'Yesterday';
		if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	};

	const tripLevel = (t: Trip): string => {
		if (typeof t.verdictLevel === 'string') return t.verdictLevel;
		try {
			const line = t.line as LatLon[];
			const v = decide(
				routeSegments(line, cumulative(line), t.pts as LatLon[], t.elev, t.cum),
				t.totalWh,
				t.usableWh,
				t.climbLimit,
				t.brakeLimit,
				MODES[t.modeId] ?? MODES.eskate
			);
			return v.level;
		} catch {
			return 'ok';
		}
	};

	const battLeft = (t: Trip): number => Math.max(0, 100 - (t.totalWh / t.usableWh) * 100);

	const deleteTrip = (idx: number): void => {
		domain.deleteTrip(idx);
	};
</script>

{#if !domain.trips.length}
	<div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
		<svg width="80" height="50" viewBox="0 0 80 50" fill="none" aria-hidden="true">
			<path
				d="M8 44 Q 16 36 24 28 Q 36 18 48 12 Q 60 6 72 4"
				stroke="var(--ink-3)"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-dasharray="5 4"
			/>
			<circle cx="8" cy="44" r="5" stroke="var(--ink-3)" stroke-width="2" fill="none" />
			<circle cx="72" cy="4" r="5" stroke="var(--ink-3)" stroke-width="2" fill="none" />
		</svg>
		<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">No saved trips yet</h3>
		<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
			Plan your first route and it lands here, ready to reopen offline — no connection needed.
		</p>
		<SlashButton label="Plan a route" size="sm" onclick={() => ui.setTab('plan')} />
	</div>
{:else}
	<div class="flex flex-col gap-2.5">
		<span class="font-mono2" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
			SAVED TRIPS · {domain.trips.length}
		</span>
		{#each domain.trips as t, i (t.ts + '-' + i)}
			{@const level = tripLevel(t)}
			{@const vc = verdictColor(level)}
			<div
				class="chamfer-card chamfer-card-interactive list-rise p-3.5"
				style="animation-delay: {Math.min(i * 35, 280)}ms; --vt: {vc};"
			>
				<button
					type="button"
					class="flex w-full cursor-pointer items-start justify-between gap-2 bg-transparent text-left"
					style="border: none;"
					onclick={() => loadTrip(t)}
					title="Open this saved trip"
					aria-label="Open saved trip {tripLabel(t)}"
				>
					<span class="min-w-0">
						<span class="font-display block truncate text-[1.05rem] leading-tight font-bold" style="color: var(--ink-0);">
							{tripLabel(t)}
						</span>
						<span class="mt-1 block text-[0.7rem]" style="color: var(--ink-2);">
							{MODES[t.modeId] ? MODES[t.modeId].label : t.modeId} · {tripType(t)}
						</span>
					</span>
					<span class="verdict-tag shrink-0">{verdictLabel(level)}</span>
				</button>
				<div class="mt-2.5 flex items-center gap-3">
					<BattRing pct={battLeft(t)} color={vc} size={46} />
					<svg width="48" height="32" viewBox="0 0 48 32" fill="none" class="shrink-0" aria-hidden="true">
						<path
							d="M4 28 Q 10 22 16 17 Q 24 12 32 8 Q 38 5 44 4"
							fill="none"
							stroke={vc}
							stroke-width="2"
							stroke-linecap="round"
						/>
						<circle cx="4" cy="28" r="3" fill="#60a5fa" />
						<circle cx="44" cy="4" r="3" fill="#22d3ee" />
					</svg>
					<div class="flex flex-1 gap-3.5">
						<div>
							<div class="font-mono2 text-[0.58rem] tracking-widest" style="color: var(--ink-2);">DIST</div>
							<div class="font-display text-sm font-bold" style="color: var(--ink-0);">{t.totalKm.toFixed(1)} km</div>
						</div>
						<div>
							<div class="font-mono2 text-[0.58rem] tracking-widest" style="color: var(--ink-2);">CLIMB</div>
							<div class="font-display text-sm font-bold" style="color: var(--ink-0);">+{t.totalClimb.toFixed(0)} m</div>
						</div>
						<div>
							<div class="font-mono2 text-[0.58rem] tracking-widest" style="color: var(--ink-2);">DATE</div>
							<div class="font-display text-sm font-bold" style="color: var(--ink-0);">{tripDay(t.ts)}</div>
						</div>
					</div>
				</div>
				<div class="mt-2.5 flex gap-1.5">
					<SlashButton label="▶ Replay" size="xs" style="flex: 1; background: color-mix(in srgb, var(--color-accent) 16%, transparent); color: var(--color-accent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 40%, transparent); filter: none;" onclick={() => loadTrip(t)} />
					<button
						type="button"
						class="slash-btn slash-btn-xs"
						style="flex: 1; background: color-mix(in srgb, var(--color-error) 10%, transparent); color: var(--color-error); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-error) 30%, transparent); filter: none;"
						title="Delete saved trip"
						aria-label="Delete saved trip {tripLabel(t)}"
						onclick={() => deleteTrip(i)}
					>
						<Mark name="x" cls="size-3" /> Delete
					</button>
				</div>
			</div>
		{/each}
	</div>
{/if}
