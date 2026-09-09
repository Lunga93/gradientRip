<script lang="ts">
	import { tick } from 'svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { scheduleAutocomplete, hideAcList, selectAcItem, acHandleKeydown } from '$lib/autocomplete.svelte.js';

	let rowsEl: HTMLDivElement;
	let railEl: HTMLDivElement;
	let searchBoxEl: HTMLDivElement;

	const stopIcon = (i: number, n: number): string => {
		if (i === 0) return '<span class="marker"><span class="origin-dot"></span></span>';
		if (i === n - 1)
			return '<span class="marker"><svg class="dest-pin" viewBox="0 0 24 24"><path d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.62 6.5 12 7.09 12.56a.55.55 0 00.82 0C13 21.5 19.5 15.12 19.5 9.5 19.5 5.36 16.14 2 12 2zm0 10.25A2.75 2.75 0 1112 6.75a2.75 2.75 0 010 5.5z"/></svg></span>';
		return '<span class="marker"><span class="waypoint-dot"></span></span>';
	};

	const stopPlaceholder = (i: number, n: number): string => {
		if (i === 0) return 'Choose starting point';
		if (i === n - 1) return 'Choose destination';
		return `Add stop ${i}`;
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
			<div class="searchrow relative flex items-center gap-2 bg-transparent px-4 py-3">
				{@html stopIcon(i, domain.stops.length)}
				<input
					type="text"
					class="flex-1 min-w-0 bg-transparent border-none outline-none text-[0.95rem] text-base-content placeholder:text-base-content/40"
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
				<button
					type="button"
					class="btn btn-circle btn-sm btn-ghost text-base-content/50 hover:text-base-content shrink-0"
					aria-label="Save this place"
					title="Save this place"
					onclick={() => savePreset(i)}
				>
					<svg viewBox="0 0 24 24" class="size-4"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" /></svg>
				</button>
				{#if i > 0 && i < domain.stops.length - 1}
					<button
						type="button"
						class="btn btn-circle btn-sm btn-ghost text-base-content/50 hover:text-error shrink-0"
						aria-label="Remove this stop"
						title="Remove this stop"
						onclick={() => removeStop(i)}
					>
						<svg viewBox="0 0 24 24" class="size-4"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
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
		<svg viewBox="0 0 24 24" class="size-4"><path d="M7 7h11l-3-3 1.4-1.4L21.8 8l-5.4 5.4L15 12l3-3H7V7zm10 10H6l3 3-1.4 1.4L2.2 16l5.4-5.4L9 12l-3 3h11v2z" /></svg>
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
						<svg class="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24"><path d="M12 2C7.86 2 4.5 5.36 4.5 9.5c0 5.62 6.5 12 7.09 12.56a.55.55 0 00.82 0C13 21.5 19.5 15.12 19.5 9.5 19.5 5.36 16.14 2 12 2zm0 10.25A2.75 2.75 0 1112 6.75a2.75 2.75 0 010 5.5z" /></svg>
						<span class="flex-1 min-w-0">{r.label}</span>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>