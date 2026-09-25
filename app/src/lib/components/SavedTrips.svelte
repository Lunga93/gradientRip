<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import { saveTrips } from '$lib/storage.js';
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

	const toggleShare = async (t: Trip): Promise<void> => {
		if (!social.signedIn) {
			ui.setStatus('Sign in on the Friends tab to share trips with buddies.', true);
			ui.setTab('friends');
			return;
		}
		const next = !t.shared;
		t.shared = next;
		const ok = await social.toggleShare(t.ts, next);
		if (!ok) {
			t.shared = !next;
			ui.setStatus(social.lastError || 'Could not update sharing — try again.', true);
			return;
		}
		saveTrips($state.snapshot(domain.trips));
		ui.setStatus(next ? 'Shared with your buddies.' : 'Back to private.');
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
		<h3 class="font-display m-0 text-base font-bold">No saved trips yet</h3>
		<p class="m-0 text-sm leading-relaxed text-base-content/70">
			Plan your first route and it lands here, ready to reopen offline — no connection needed.
		</p>
		<SlashButton label="Plan a route" size="sm" onclick={() => ui.setTab('plan')} />
	</div>
{:else}
	<div class="flex flex-col gap-2.5">
		<span class="font-mono2 text-[0.62rem] tracking-[0.16em] text-base-content/60">
			SAVED TRIPS · {domain.trips.length}
		</span>
		{#each domain.trips as t, i (t.ts + '-' + i)}
			{@const level = tripLevel(t)}
			{@const vc = verdictColor(level)}
			<div
				class="card border-base-300 bg-base-100 list-rise border shadow-sm"
				style="animation-delay: {Math.min(i * 35, 280)}ms;"
			>
				<div class="card-body gap-2.5 p-3.5">
				<button
					type="button"
					class="flex w-full cursor-pointer items-start justify-between gap-2 text-left"
					onclick={() => loadTrip(t)}
					title="Open this saved trip"
					aria-label="Open saved trip {tripLabel(t)}"
				>
					<span class="min-w-0">
						<span class="font-display block truncate text-[1.05rem] leading-tight font-bold">
							{tripLabel(t)}
						</span>
						<span class="mt-1 block text-[0.7rem] text-base-content/60">
							{MODES[t.modeId] ? MODES[t.modeId].label : t.modeId} · {tripType(t)}
						</span>
					</span>
					<span class="badge badge-soft shrink-0" style="color: {vc};">{verdictLabel(level)}</span>
				</button>
				<div class="flex items-center gap-3">
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
							<div class="font-mono2 text-[0.58rem] tracking-widest text-base-content/60">DIST</div>
							<div class="font-display text-sm font-bold">{t.totalKm.toFixed(1)} km</div>
						</div>
						<div>
							<div class="font-mono2 text-[0.58rem] tracking-widest text-base-content/60">CLIMB</div>
							<div class="font-display text-sm font-bold">+{t.totalClimb.toFixed(0)} m</div>
						</div>
						<div>
							<div class="font-mono2 text-[0.58rem] tracking-widest text-base-content/60">DATE</div>
							<div class="font-display text-sm font-bold">{tripDay(t.ts)}</div>
						</div>
					</div>
				</div>
				<div class="flex gap-1.5">
					<SlashButton label="▶ Replay" size="xs" variant="secondary" style="flex: 1;" onclick={() => loadTrip(t)} />
					<button
						type="button"
						class="btn btn-xs flex-1"
						class:btn-success={t.shared}
						class:btn-soft={t.shared}
						class:btn-ghost={!t.shared}
						title={t.shared ? 'Visible to your buddies — tap to make private' : 'Private — tap to share with buddies'}
						aria-label="{t.shared ? 'Unshare' : 'Share'} saved trip {tripLabel(t)}"
						aria-pressed={t.shared}
						onclick={() => toggleShare(t)}
					>
						{t.shared ? '★ Shared' : '☆ Share'}
					</button>
					<button
						type="button"
						class="btn btn-error btn-soft btn-xs flex-1"
						title="Delete saved trip"
						aria-label="Delete saved trip {tripLabel(t)}"
						onclick={() => deleteTrip(i)}
					>
						<Mark name="x" cls="size-3" /> Delete
					</button>
				</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
