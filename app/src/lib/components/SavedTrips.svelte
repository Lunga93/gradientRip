<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';

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

	const goPlan = (): void => {
		void goto(resolve('/map'));
	};

	// loadTrip renders onto the map, which isn't mounted on /me/rides — the
	// throw happens after domain.results is set, so fall back to the same
	// /ride landing (ResultsPanel reads domain.results; /map restores the
	// render on next mount).
	const isFreshResults = (t: Trip): boolean => {
		const r = domain.results;
		return !!r && r.line === (t.line as LatLon[]);
	};
	const openTrip = (t: Trip): void => {
		try {
			loadTrip(t);
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			if (!msg.includes('Map not initialised') || !isFreshResults(t)) throw err;
			// Cleaner long-term fix: a pending-route queue in mapController
			// flushed on createMap, instead of relying on applyResult ordering.
			void goto(resolve('/ride'));
		}
	};

	const toggleShare = async (t: Trip): Promise<void> => {
		if (!social.signedIn) {
			ui.setStatus('Sign in on your profile to share trips with buddies.', true);
			void goto(resolve('/me'));
			return;
		}
		const next = !t.shared;
		t.shared = next; // optimistic — reverted below on failure
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
				stroke="var(--text-disabled)"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-dasharray="5 4"
			/>
			<circle cx="8" cy="44" r="5" stroke="var(--text-disabled)" stroke-width="2" fill="none" />
			<circle cx="72" cy="4" r="5" stroke="var(--text-disabled)" stroke-width="2" fill="none" />
		</svg>
		<h3 class="font-display m-0 text-base font-bold" style="color: var(--text-primary);">No saved trips yet</h3>
		<p class="m-0 text-sm leading-relaxed" style="color: var(--text-secondary);">
			Plan your first route and it lands here, ready to reopen offline — no connection needed.
		</p>
		<PrimaryButton label="Plan a route" onclick={goPlan} />
	</div>
{:else}
	<div class="flex flex-col gap-2.5">
		<span style="font: var(--type-label); letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-tertiary);">
			SAVED TRIPS · {domain.trips.length}
		</span>
		{#each domain.trips as t, i (t.ts + '-' + i)}
			{@const level = tripLevel(t)}
			{@const vc = verdictColor(level)}
			<div
				class="list-rise p-3.5"
				style="animation-delay: {Math.min(i * 35, 280)}ms; background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
			<button
				type="button"
				class="trip-open flex w-full cursor-pointer items-start justify-between gap-2 bg-transparent text-left"
				style="border: none; min-height: 44px;"
				onclick={() => openTrip(t)}
				title="Open this saved trip"
				aria-label="Open saved trip {tripLabel(t)}"
			>
				<span class="min-w-0">
					<span class="font-display block truncate text-[1.05rem] leading-tight font-bold" style="color: var(--text-primary);">
						{tripLabel(t)}
					</span>
					<span class="mt-1 block" style="font: var(--type-label); color: var(--text-secondary);">
						{MODES[t.modeId] ? MODES[t.modeId].label : t.modeId} · {tripType(t)}
					</span>
				</span>
				<span
					class="font-mono2 shrink-0 rounded-full px-2 py-1"
					style="font: var(--type-label); background: color-mix(in srgb, {vc} 16%, transparent); color: {vc};"
				>
					{verdictLabel(level)}
				</span>
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
							<div style="font: var(--type-label); color: var(--text-tertiary);">DIST</div>
							<div class="font-display text-sm font-bold" style="color: var(--text-primary);">{t.totalKm.toFixed(1)} km</div>
						</div>
						<div>
							<div style="font: var(--type-label); color: var(--text-tertiary);">CLIMB</div>
							<div class="font-display text-sm font-bold" style="color: var(--text-primary);">+{t.totalClimb.toFixed(0)} m</div>
						</div>
						<div>
							<div style="font: var(--type-label); color: var(--text-tertiary);">DATE</div>
							<div class="font-display text-sm font-bold" style="color: var(--text-primary);">{tripDay(t.ts)}</div>
						</div>
					</div>
				</div>
			<div class="mt-2.5 flex gap-1.5">
				<div style="flex: 1; display: grid;">
					<SecondaryButton
						label="▶ Replay"
						ariaLabel="Replay trip {tripLabel(t)}"
						title="Replay trip {tripLabel(t)}"
						onclick={() => openTrip(t)}
					/>
				</div>
				<div style="flex: 1; display: grid;">
					<SecondaryButton
						label={t.shared ? '★ Shared' : '☆ Share'}
						title={t.shared ? 'Visible to your buddies — tap to make private' : 'Private — tap to share with buddies'}
						ariaLabel="Share saved trip {tripLabel(t)}"
						ariaPressed={!!t.shared}
						onclick={() => toggleShare(t)}
					/>
				</div>
				<div style="flex: 1; display: grid;">
					<SecondaryButton
						label="Delete"
						title="Delete saved trip"
						ariaLabel="Delete saved trip {tripLabel(t)}"
						onclick={() => deleteTrip(i)}
					/>
				</div>
			</div>
			</div>
		{/each}
	</div>
{/if}
