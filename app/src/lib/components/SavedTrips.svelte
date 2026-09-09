<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { MODES } from '$lib/engine/index.js';
	import { loadTrip } from '$lib/planner.svelte.js';
	import type { Trip } from '$lib/storage.js';

	const tripIcon = (t: Trip): string => {
		if (t.recorded)
			return '<span class="grid size-10 shrink-0 place-items-center rounded-full bg-error/10 text-error"><svg viewBox="0 0 24 24" class="size-4"><circle cx="12" cy="12" r="7"/></svg></span>';
		if (t.drawn)
			return '<span class="grid size-10 shrink-0 place-items-center rounded-full bg-secondary/10 text-secondary"><svg viewBox="0 0 24 24" class="size-4"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></span>';
		return '<span class="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><svg viewBox="0 0 24 24" class="size-4"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z"/></svg></span>';
	};

	const tripLabel = (t: Trip): string => {
		const prefix = t.recorded ? 'Recorded: ' : t.drawn ? 'Drawn: ' : '';
		return prefix + t.queries.join(' → ');
	};

	const tripMeta = (t: Trip): string => {
		const modeLabel = MODES[t.modeId] ? MODES[t.modeId].label : t.modeId;
		return `${modeLabel} · ${t.totalKm.toFixed(1)} km · ${new Date(t.ts).toLocaleString()}`;
	};

	const deleteTrip = (idx: number): void => {
		domain.deleteTrip(idx);
	};
</script>

{#if !domain.trips.length}
	<div class="flex flex-col items-center gap-3 px-6 py-14 text-center">
		<span class="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
			<svg viewBox="0 0 24 24" class="size-7"><path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" /></svg>
		</span>
		<h3 class="text-base font-semibold text-base-content">No saved trips yet</h3>
		<p class="text-sm leading-relaxed text-base-content/60">
			Plan a route from the start tab and it lands here, ready to reopen offline — no connection needed.
		</p>
			<button class="btn btn-hero mt-2" type="button" onclick={() => ui.setTab('plan')}>Plan a route</button>
	</div>
{:else}
	<div class="flex flex-col gap-2">
		{#each domain.trips as t, i (t.ts + '-' + i)}
			<div
				class="list-rise group flex items-center gap-3 rounded-2xl border border-base-300 bg-base-200 p-2.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
				style="animation-delay: {Math.min(i * 35, 280)}ms"
			>
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-3 bg-transparent text-left"
					onclick={() => loadTrip(t)}
					title="Open this saved trip"
					aria-label="Open saved trip {tripLabel(t)}"
				>
					{@html tripIcon(t)}
				<span class="min-w-0 flex-1">
					<span class="font-display block truncate text-[0.88rem] font-semibold text-base-content">{tripLabel(t)}</span>
						<span class="mt-0.5 block text-[0.72rem] text-base-content/55">{tripMeta(t)}</span>
					</span>
				</button>
				<button
					type="button"
					class="btn btn-circle btn-sm btn-ghost text-base-content/40 opacity-70 hover:bg-error/15 hover:text-error group-hover:opacity-100"
					title="Delete saved trip"
					aria-label="Delete saved trip {tripLabel(t)}"
					onclick={() => deleteTrip(i)}
				>
					<svg viewBox="0 0 24 24" class="size-4"><path d="M6 7h12l-1 14H7L6 7zm4 2v10h1V9h-1zm3 0v10h1V9h-1zM5 5V4h4l1-1h4l1 1h4v1H5z" /></svg>
				</button>
			</div>
		{/each}
	</div>
{/if}