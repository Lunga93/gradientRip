<script lang="ts">
	import { tick } from 'svelte';
	import { domain, BOARD_RANGES } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import ModePicker from './ModePicker.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { autocompleteSearch, reverseGeocode } from '$lib/api.js';
	import { readOnboardingDraft, writeOnboardingDraft } from '$lib/profiles/onboarding.js';

	// Google prefill arrives as props (wired to social.me by the caller);
	// everything stays editable and every step can be skipped.
	let { initialName = '', initialSports = [] }: { initialName?: string; initialSports?: string[] } =
		$props();

	const draft = readOnboardingDraft();

	let step = $state(1);
	// Prefill snapshots into local editable state (initial capture is intended).
	let displayName = $state(initialName || draft.displayName);
	let sports = $state<string[]>(initialSports.length > 0 ? initialSports : draft.sports);
	let homeLabel = $state(draft.home?.label ?? '');
	let home = $state<{ lat: number; lon: number; label: string } | null>(draft.home);
	let homeError = $state('');
	let locating = $state(false);

	let cardEl = $state<HTMLDivElement | undefined>(undefined);

	const SPORT_OPTIONS = [
		{ id: 'eskate', label: 'E-Skate' },
		{ id: 'ebike', label: 'E-Bike' },
		{ id: 'scooter', label: 'E-Scooter' },
		{ id: 'euc', label: 'EUC' },
		{ id: 'push', label: 'Push' },
		{ id: 'bike', label: 'Bike' },
		{ id: 'kick', label: 'Kick' }
	] as const;

	const toggleSport = (id: string): void => {
		sports = sports.includes(id) ? sports.filter((s) => s !== id) : [...sports, id];
	};

	// Google (social.me) prefill for the name — once, and only when the user
	// hasn't already typed or restored a name. Always stays editable.
	let googleApplied = $state(false);
	$effect(() => {
		if (googleApplied || displayName) return;
		if (social.me === undefined) {
			void social.probeMe();
			return;
		}
		googleApplied = true;
		const prefill = initialName || social.me?.display_name?.trim() || '';
		if (prefill) displayName = prefill.slice(0, 40);
	});

	$effect(() => {
		if (!domain.onboardSeen) {
			tick().then(() => {
				cardEl?.focus();
			});
		}
	});

	// --- Step 2: board steppers reused from OnboardingModal ---
	const spec = $derived.by(() => {
		const parts = (domain.boardVal || '').split('|').map(Number);
		const maxCap = Math.max(...domain.boards.map((b) => Number(b.value.split('|')[0]) || 0), 1);
		const cap = Number.isFinite(parts[0]) ? parts[0] : 0;
		const climb = Number.isFinite(parts[1]) ? parts[1] : 0;
		const brake = Number.isFinite(parts[2]) ? parts[2] : 0;
		const human = domain.mode.human;
		return [
			{ key: 'cap', l: human ? 'DAY BUDGET' : 'BATTERY', v: `${cap} ${human ? 'kcal' : 'Wh'}`, pct: cap / maxCap },
			{ key: 'climb', l: 'MAX CLIMB', v: `${climb}%`, pct: climb / 40 },
			{ key: 'brake', l: 'BRAKE LIMIT', v: `${brake}%`, pct: brake / 30 }
		] as const;
	});

	const presetLabel = $derived(
		domain.boards.find((b) => b.value === domain.boardVal)?.label ?? 'CUSTOM SETUP'
	);

	const STEPS = { cap: 50, climb: 1, brake: 1 } as const;

	// First nudge converts the preset into a persisted custom triple, so
	// results stay curated to these numbers.
	const nudge = (key: 'cap' | 'climb' | 'brake', dir: 1 | -1): void => {
		const parts = (domain.boardVal || '').split('|').map(Number);
		const cur = {
			cap: Number.isFinite(parts[0]) ? parts[0] : 0,
			climb: Number.isFinite(parts[1]) ? parts[1] : 0,
			brake: Number.isFinite(parts[2]) ? parts[2] : 0
		};
		const [lo, hi] = BOARD_RANGES[key];
		cur[key] = Math.min(hi, Math.max(lo, cur[key] + dir * STEPS[key]));
		domain.setCustomBoard(cur.cap, cur.climb, cur.brake);
	};

	// --- Step 3: home input with Photon autocomplete + Use-my-location ---
	let acResults = $state<{ label: string; lat: number; lon: number }[]>([]);
	let acTimer: ReturnType<typeof setTimeout> | undefined = undefined;
	let acController: AbortController | undefined = undefined;

	const onHomeInput = (e: Event): void => {
		homeLabel = (e.target as HTMLInputElement).value;
		// Typing invalidates any exact fix (same semantics as stop fields).
		home = null;
		homeError = '';
		if (acTimer) clearTimeout(acTimer);
		const clean = homeLabel.replace(/\s+/g, ' ').trim();
		if (clean.length < 3) {
			acController?.abort();
			acResults = [];
			return;
		}
		acTimer = setTimeout(() => void runHomeSearch(clean), 450);
	};

	const runHomeSearch = async (query: string): Promise<void> => {
		acController?.abort();
		const controller = new AbortController();
		acController = controller;
		try {
			const results = await autocompleteSearch(query, controller.signal);
			if (controller.signal.aborted) return;
			acResults = results;
		} catch (err) {
			if ((err as Error).name !== 'AbortError') acResults = [];
		}
	};

	const pickHome = (i: number): void => {
		const r = acResults[i];
		if (!r) return;
		homeLabel = r.label;
		home = { lat: r.lat, lon: r.lon, label: r.label };
		acResults = [];
	};

	const useMyLocation = (): void => {
		homeError = '';
		if (!navigator.geolocation || !window.isSecureContext) {
			homeError = window.isSecureContext
				? 'Geolocation is not available in this browser.'
				: 'Location needs a secure connection (https).';
			return;
		}
		locating = true;
		navigator.geolocation.getCurrentPosition(
			async (pos) => {
				const { latitude, longitude } = pos.coords;
				let label: string;
				try {
					label = await reverseGeocode(latitude, longitude);
				} catch {
					label = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
				}
				homeLabel = label;
				home = { lat: latitude, lon: longitude, label };
				acResults = [];
				locating = false;
			},
			() => {
				locating = false;
				homeError = 'Could not get your location — type it instead.';
			},
			{ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
		);
	};

	// --- navigation: skip is always available, finish keeps onboardSeen semantics ---
	const persist = (): void => {
		writeOnboardingDraft({
			displayName,
			sports,
			modeId: domain.modeId,
			boardVal: domain.boardVal,
			home
		});
	};

	const finish = (): void => {
		persist();
		domain.completeOnboarding();
		ui.setTab('plan');
	};

	const next = (): void => {
		if (step < 3) step += 1;
		else finish();
	};

	const back = (): void => {
		if (step > 1) step -= 1;
	};

	const onKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') finish();
	};

	const stepLabel = $derived(step === 1 ? 'YOU' : step === 2 ? 'RIDE' : 'HOME');
</script>

{#if !domain.onboardSeen}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		style="background: linear-gradient(160deg, var(--app-bg) 0%, var(--color-base-200) 100%);"
	>
		<div
			class="relative mx-auto flex min-h-full w-full max-w-sm px-6 py-10"
			role="dialog"
			aria-modal="true"
			aria-labelledby="wizardTitle"
			bind:this={cardEl}
			onkeydown={onKeydown}
			tabindex="-1"
		>
			<div class="m-auto flex w-full flex-col items-center gap-7">
				<div class="anim-slide-up flex flex-col items-center gap-2">
					<Mark name="route" cls="size-10 text-primary" />
					<h1
						id="wizardTitle"
						class="font-display m-0"
						style="font-weight: 700; font-size: 3.25rem; letter-spacing: -0.02em; line-height: 1;"
					>
						<span class="wordmark">GradientRip</span>
					</h1>
					<p class="font-mono2 m-0" style="font-size: 0.68rem; letter-spacing: 0.14em; color: var(--ink-2); line-height: 1.5;">
						STEP {step} OF 3 — {stepLabel}
					</p>
				</div>

				{#if step === 1}
					<div class="anim-slide-up w-full" style="animation-delay: 0.1s;">
						<div class="sec-label">What should we call you?</div>
						<input
							type="text"
							class="stop-box w-full px-3 py-2 text-base-content outline-none"
							style="font-size: 0.9rem; font-weight: 500;"
							placeholder="Rider name"
							maxlength="40"
							autocomplete="nickname"
							aria-label="Display name"
							bind:value={displayName}
						/>
					</div>

					<div class="anim-slide-up w-full" style="animation-delay: 0.16s;">
						<div class="sec-label">What do you ride?</div>
						<div class="flex flex-wrap gap-1.5" role="group" aria-label="Sports">
							{#each SPORT_OPTIONS as opt (opt.id)}
								{@const picked = sports.includes(opt.id)}
								<button
									type="button"
									class="mode-chip"
									class:mode-chip-picked={picked}
									aria-pressed={picked}
									onclick={() => toggleSport(opt.id)}
								>
									{opt.label}
								</button>
							{/each}
						</div>
					</div>
				{:else if step === 2}
					<div class="anim-slide-up w-full" style="animation-delay: 0.1s;">
						<div class="sec-label">Choose your ride</div>
						<ModePicker variant="onboard" />
					</div>

					<div class="anim-slide-up chamfer-card w-full" style="animation-delay: 0.18s;">
						<div class="flex items-center justify-between gap-2 px-4 py-3" style="border-bottom: 1px solid var(--panel-line);">
							<span class="font-mono2" style="font-size: 0.62rem; letter-spacing: 0.14em; color: var(--ink-2);"
								>BOARD CONFIGURATION</span
							>
							<span class="font-mono2 truncate" style="font-size: 0.6rem; letter-spacing: 0.1em; color: var(--color-primary);">{presetLabel.toUpperCase()}</span>
						</div>
						<div class="flex flex-col gap-2.5 px-4 py-3">
							{#each spec as cfg (cfg.l)}
								<div class="flex items-center gap-2.5">
									<span class="font-mono2 w-24 shrink-0" style="font-size: 0.62rem; letter-spacing: 0.08em; color: var(--ink-2);">{cfg.l}</span>
									<div class="h-[3px] flex-1" style="background: var(--panel-line); border-radius: 2px;">
										<div
											style="width: {Math.min(100, Math.max(4, cfg.pct * 100))}%; height: 100%; border-radius: 2px; background: linear-gradient(90deg, var(--color-primary), var(--color-accent)); box-shadow: 0 0 6px var(--brand-glow);"
										></div>
									</div>
									<div class="flex shrink-0 items-center gap-1">
										<button
											type="button"
											class="spec-step"
											aria-label="Decrease {cfg.l}"
											title="Decrease {cfg.l}"
											onclick={() => nudge(cfg.key, -1)}
										>−</button>
										<span class="font-mono2 w-16 shrink-0 text-center" style="font-size: 0.68rem; font-weight: 600; color: var(--color-primary);">{cfg.v}</span>
										<button
											type="button"
											class="spec-step"
											aria-label="Increase {cfg.l}"
											title="Increase {cfg.l}"
											onclick={() => nudge(cfg.key, 1)}
										>+</button>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{:else}
					<div class="anim-slide-up w-full" style="animation-delay: 0.1s;">
						<div class="sec-label">Where is home base?</div>
						<div class="relative">
							<input
								type="text"
								class="stop-box w-full px-3 py-2 text-base-content outline-none"
								style="font-size: 0.9rem; font-weight: 500;"
								placeholder="Search for your home spot"
								autocomplete="off"
								role="combobox"
								aria-expanded={acResults.length > 0}
								aria-controls="homeAcList"
								aria-label="Home location"
								value={homeLabel}
								oninput={onHomeInput}
							/>
							{#if acResults.length > 0}
								<div class="ac-list" id="homeAcList" role="listbox" aria-label="Place suggestions">
									{#each acResults as r, i (r.lat + ',' + r.lon)}
										<div
											class="ac-item"
											role="option"
											tabindex="-1"
											aria-selected="false"
											onmousedown={(e) => {
												e.preventDefault();
												pickHome(i);
											}}
										>
											<Mark name="pin" cls="mt-0.5 shrink-0" />
											<span class="min-w-0 flex-1">{r.label}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
						{#if homeError}
							<p class="mt-1.5 text-[0.75rem] text-error" role="alert">{homeError}</p>
						{/if}
						{#if home}
							<p class="mt-1.5 text-[0.75rem]" style="color: var(--ink-2);">
								Home base: {home.label}
							</p>
						{/if}
						<button
							type="button"
							class="board-chip mt-2.5 w-full"
							onclick={useMyLocation}
							disabled={locating}
							title="Fill home with your current GPS location"
						>
							<span class="inline-flex items-center gap-1.5"><Mark name="pin" cls="size-3.5" />{locating ? 'LOCATING…' : 'USE MY LOCATION'}</span>
						</button>
					</div>
				{/if}

				<div class="anim-slide-up flex w-full gap-2" style="animation-delay: 0.24s;">
					{#if step > 1}
						<SlashButton label="← BACK" variant="secondary" style="flex: 1;" onclick={back} />
					{/if}
					<SlashButton label={step === 3 ? "LET'S ROLL →" : 'CONTINUE →'} style="flex: 2;" onclick={next} />
				</div>
				<button
					type="button"
					class="font-mono2"
					style="font-size: 0.68rem; letter-spacing: 0.12em; color: var(--ink-2); background: transparent; border: none; cursor: pointer;"
					onclick={finish}
				>
					SKIP FOR NOW
				</button>
			</div>
		</div>
	</div>
{/if}
