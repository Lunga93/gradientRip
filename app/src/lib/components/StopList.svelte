<script lang="ts">
	import { tick } from 'svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { scheduleAutocomplete, hideAcList, selectAcItem, acHandleKeydown } from '$lib/autocomplete.svelte.js';
	import { Bookmark, X, Swap, DestinationPin, OriginDot, WaypointDot } from '$lib/icons/index.js';
	import AddressFocus from './AddressFocus.svelte';

	let rowsEl: HTMLDivElement;
	let railEl: HTMLDivElement;
	let searchBoxEl: HTMLDivElement;

	const stopPlaceholder = (i: number, n: number): string => {
		if (i === 0) return 'Choose starting point';
		if (i === n - 1) return 'Choose destination';
		return `Add stop ${i}`;
	};

	// Get the matching preset for a stop value
	const getFavoritePreset = (value: string) => {
		const val = value.trim().toLowerCase();
		return domain.presets.find(p => p.query.trim().toLowerCase() === val);
	};

	const positionRail = async (): Promise<void> => {
		await tick();
		if (!rowsEl || !railEl || !searchBoxEl) return;
		const markers = rowsEl.querySelectorAll('.marker');
		if (markers.length < 2) {
			railEl.style.display = 'none';
			return;
		}
		const boxTop = searchBoxEl.getBoundingClientRect().top;
		const first = markers[0].getBoundingClientRect();
		const last = markers[markers.length - 1].getBoundingClientRect();
		railEl.style.display = '';
		const top = first.top - boxTop + first.height / 2 + 6;
		const height = Math.max(0, last.top - boxTop + last.height / 2 - 6 - top);
		railEl.style.top = top + 'px';
		railEl.style.height = height + 'px';
	};

	$effect(() => {
		domain.stops.length; // eslint-disable-line @typescript-eslint/no-unused-expressions
		positionRail();
	});

	const onInput = (i: number, e: Event): void => {
		const value = (e.target as HTMLInputElement).value;
		domain.setStopValue(i, value);
		scheduleAutocomplete(i, value);
	};

	const onFocus = (i: number, e: Event): void => {
		domain.focusStop(i);
		(e.target as HTMLInputElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
	};

	const onBlur = (): void => {
		setTimeout(() => hideAcList(), 150);
	};

	const savePreset = (i: number): void => {
		domain.saveStopAsPreset(i);
	};

	const removeStop = (i: number): void => {
		domain.removeStop(i);
	};

	const pickResult = (i: number): void => {
		selectAcItem(i);
	};
</script>

<div class="searchbox relative" bind:this={searchBoxEl} role="group" aria-label="Route stops">
	<div class="rail absolute inset-y-0 left-[23px] w-px border-l-2 border-dotted" bind:this={railEl} aria-hidden="true" style="border-color: var(--gridline);"></div>

	<div class="flex flex-col" bind:this={rowsEl}>
		{#each domain.stops as s, i (s.id)}
			<div class="searchrow group relative flex items-center gap-2 bg-transparent px-4 py-3">
				<span class="marker flex items-center justify-center">
					{#if i === 0}
						<OriginDot class="size-4" />
					{:else if i === domain.stops.length - 1}
						<DestinationPin class="size-4" />
					{:else}
						<WaypointDot class="size-4" />
					{/if}
				</span>
				<div class="flex-1 min-w-0 relative">
					<input
						type="text"
						class="flex-1 min-w-0 bg-transparent border-none outline-none text-[0.95rem] text-base-content placeholder:text-base-content/40 pr-10 focus:ring-2 focus:ring-primary/40 focus:ring-offset-1 rounded-lg"
						placeholder={stopPlaceholder(i, domain.stops.length)}
						autocomplete="off"
						role="combobox"
						aria-expanded={session.acIdx === i && session.acResults.length > 0}
						aria-controls="acList"
						aria-autocomplete="list"
						aria-activedescendant={session.acIdx === i && session.acActive >= 0 ? `ac-option-${session.acActive}` : undefined}
						bind:value={s.value}
						oninput={(e) => onInput(i, e)}
						onfocus={(e) => onFocus(i, e)}
						onblur={onBlur}
						onkeydown={(e) => acHandleKeydown(e, i)}
					/>
					<!-- Favorite/bookmark indicator -->
					{#if getFavoritePreset(s.value)}
						<span class="absolute right-2 top-1/2 -translate-y-1/2 text-primary opacity-80 pointer-events-none" title="Saved place: {getFavoritePreset(s.value)?.label}" aria-label="Saved place: {getFavoritePreset(s.value)?.label}">
							<Bookmark class="size-4 fill-current" />
						</span>
					{/if}
					<!-- Address focus suggestions -->
					<AddressFocus stopIndex={i} />
				</div>
			<button
				type="button"
				class="btn btn-circle btn-sm btn-ghost text-base-content/40 hover:text-primary shrink-0"
				aria-label="Save this place"
				title="Save this place"
				onclick={() => savePreset(i)}
			>
				<Bookmark />
			</button>
				{#if i > 0 && i < domain.stops.length - 1}
					<button
						type="button"
						class="btn btn-circle btn-sm btn-ghost text-base-content/50 hover:text-error opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
						aria-label="Remove this stop"
						title="Remove this stop"
						onclick={() => removeStop(i)}
					>
						<X />
					</button>
				{/if}
			</div>
		{/each}
	</div>

	<button
		type="button"
		class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-circle btn-sm btn-ghost border border-base-300 bg-base-100 text-base-content/70 shadow-sm hover:border-primary hover:text-primary z-10"
		aria-label="Reverse stop order"
		title="Reverse stop order"
		onclick={() => domain.reverseStops()}
	>
		<Swap />
	</button>

	{#if session.acIdx !== null && (session.acResults.length > 0 || session.acActive === -1)}
		<div class="ac-list absolute top-full left-0 right-0 mt-1.5 z-20" id="acList" role="listbox" aria-label="Place suggestions">
			{#if session.acResults.length === 0}
				<div class="ac-empty px-3 py-2 text-sm text-base-content/60">No matches nearby</div>
			{:else}
				{#each session.acResults as r, i (r.lat + ',' + r.lon)}
					<div
						id="ac-option-{i}"
						class="ac-item flex items-start gap-3 px-3 py-2 cursor-pointer text-sm text-base-content"
						role="option"
						tabindex="-1"
						aria-selected={session.acActive === i}
						onmousedown={(e) => { e.preventDefault(); pickResult(i); }}
					>
						<DestinationPin class="size-4 shrink-0 mt-0.5" />
						<span class="flex-1 min-w-0">{r.label}</span>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>