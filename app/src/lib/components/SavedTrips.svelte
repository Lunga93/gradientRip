<script lang="ts">
	import { domain } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { MODES } from '$lib/engine/index.js';
	import { loadTrip } from '$lib/planner.svelte.js';
	import type { Trip } from '$lib/storage.js';
	import { Circle, Pen, Folder, X } from '$lib/icons/index.js';

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
			<Folder class="size-7" />
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
				class="list-rise card card-interactive group flex items-center gap-3 p-3 text-left"
				style="animation-delay: {Math.min(i * 35, 280)}ms"
			>
				<button
					type="button"
					class="flex min-w-0 flex-1 items-center gap-3 bg-transparent text-left"
					onclick={() => loadTrip(t)}
					title="Open this saved trip"
					aria-label="Open saved trip {tripLabel(t)}"
				>
					<span class="grid size-10 shrink-0 place-items-center rounded-full bg-error/10 text-error">
						{#if t.recorded}
							<Circle class="size-4 fill-current" />
						{:else if t.drawn}
							<Pen class="size-4" />
						{:else}
							<Folder class="size-4" />
						{/if}
					</span>
				<span class="min-w-0 flex-1">
					<span class="font-display block truncate text-[0.88rem] font-semibold text-base-content">{tripLabel(t)}</span>
						<span class="mt-0.5 block text-[0.72rem] text-base-content/55">{tripMeta(t)}</span>
					</span>
				</button>
				<button
					type="button"
					class="btn btn-circle btn-sm btn-ghost text-base-content/40 opacity-70 hover:bg-error/15 hover:text-error group-hover:opacity-100 transition-opacity"
					title="Delete saved trip"
					aria-label="Delete saved trip {tripLabel(t)}"
					onclick={() => deleteTrip(i)}
				>
					<X class="size-4" />
				</button>
			</div>
		{/each}
	</div>
{/if}