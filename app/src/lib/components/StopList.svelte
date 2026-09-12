<script lang="ts">
	import { tick } from 'svelte';
	import { domain } from '$lib/state/domain.svelte.js';
	import { session } from '$lib/state/session.svelte.js';
	import { scheduleAutocomplete, hideAcList, selectAcItem, acHandleKeydown } from '$lib/autocomplete.svelte.js';
	import Mark from '$lib/components/Mark.svelte';
	import AddressFocus from './AddressFocus.svelte';

	let rowsEl: HTMLDivElement;
	let railEl: HTMLDivElement;
	let searchBoxEl: HTMLDivElement;

	const stopPlaceholder = (i: number, n: number): string => {
		if (i === 0) return 'Choose starting point';
		if (i === n - 1) return 'Choose destination';
		return `Add stop ${i}`;
	};

	const stopKind = (i: number, n: number): string => {
		if (i === 0) return 'ORIGIN';
		if (i === n - 1) return 'DEST';
		return `STOP ${i}`;
	};

	const dotColor = (i: number, n: number): string => {
		if (i === 0) return '#8b5cf6';
		if (i === n - 1) return '#22d3ee';
		return '#f59e0b';
	};

	const getFavoritePreset = (value: string) => {
		const val = value.trim().toLowerCase();
		return domain.presets.find((p) => p.query.trim().toLowerCase() === val);
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
	<div
		class="rail absolute inset-y-0 left-[27px] w-px"
		bind:this={railEl}
		aria-hidden="true"
		style="background: linear-gradient(to bottom, rgba(139,92,246,0.6), rgba(34,211,238,0.6));"
	></div>

	<div class="flex flex-col gap-2" bind:this={rowsEl}>
		{#each domain.stops as s, i (s.id)}
			<div class="group relative flex items-center gap-2.5">
				<span
					class="marker stop-dot"
					style="background: {dotColor(i, domain.stops.length)}; box-shadow: 0 0 10px {dotColor(
						i,
						domain.stops.length
					)};"
				>
					{i === 0 ? 'A' : i === domain.stops.length - 1 ? 'B' : i}
				</span>
				<div class="relative min-w-0 flex-1">
					<div class="stop-box px-3 py-2">
						<div
							class="font-mono2"
							style="font-size: 0.6rem; letter-spacing: 0.1em; color: var(--ink-2); margin-bottom: 1px;"
						>
							{stopKind(i, domain.stops.length)}
						</div>
						<input
							type="text"
							class="w-full border-none bg-transparent text-base-content outline-none placeholder:[color:var(--ink-2)]"
							style="font-size: 0.85rem; font-weight: 500; padding-right: 1.4rem;"
							placeholder={stopPlaceholder(i, domain.stops.length)}
							autocomplete="off"
							role="combobox"
							aria-expanded={session.acIdx === i && session.acResults.length > 0}
							aria-controls="acList"
							aria-autocomplete="list"
							aria-activedescendant={session.acIdx === i && session.acActive >= 0
								? `ac-option-${session.acActive}`
								: undefined}
							bind:value={s.value}
							oninput={(e) => onInput(i, e)}
							onfocus={(e) => onFocus(i, e)}
							onblur={onBlur}
							onkeydown={(e) => acHandleKeydown(e, i)}
						/>
					</div>
					{#if getFavoritePreset(s.value)}
						<span
							class="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-primary opacity-80"
							title="Saved place: {getFavoritePreset(s.value)?.label}"
							aria-label="Saved place: {getFavoritePreset(s.value)?.label}"
						>
							<Mark name="bookmark" cls="size-4" />
						</span>
					{/if}
					<AddressFocus stopIndex={i} />
				</div>
				<button
					type="button"
					class="grid size-11 -m-1.5 shrink-0 cursor-pointer place-items-center text-base-content/40 transition-colors hover:text-primary"
					style="background: transparent; border: none;"
					aria-label="Save this place"
					title="Save this place"
					onclick={() => savePreset(i)}
				>
					<Mark name="bookmark" cls="size-4" />
				</button>
				{#if i > 0 && i < domain.stops.length - 1}
					<button
						type="button"						class="grid size-11 -m-1.5 shrink-0 cursor-pointer place-items-center text-base-content/50 transition-opacity hover:text-error"
						style="background: transparent; border: none;"
						aria-label="Remove this stop"
						title="Remove this stop"
						onclick={() => removeStop(i)}
					>
						<Mark name="x" cls="size-4" />
					</button>
				{/if}
			</div>
		{/each}
	</div>

	{#if session.acIdx !== null && (session.acResults.length > 0 || session.acActive === -1)}
		<div class="ac-list" id="acList" role="listbox" aria-label="Place suggestions">
			{#if session.acResults.length === 0}
				<div class="ac-empty">No matches nearby</div>
			{:else}
				{#each session.acResults as r, i (r.lat + ',' + r.lon)}
					<div
						id="ac-option-{i}"
						class="ac-item"
						class:active={session.acActive === i}
						role="option"
						tabindex="-1"
						aria-selected={session.acActive === i}
						onmousedown={(e) => {
							e.preventDefault();
							pickResult(i);
						}}
					>
						<Mark name="pin" cls="mt-0.5 shrink-0" />
						<span class="min-w-0 flex-1">{r.label}</span>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
