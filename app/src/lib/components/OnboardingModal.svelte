<script lang="ts">
	import { domain, BOARD_RANGES } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import ModePicker from './ModePicker.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import RouteMotif from '$lib/components/RouteMotif.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { tick } from 'svelte';

	let cardEl = $state<HTMLDivElement | undefined>(undefined);

	$effect(() => {
		if (!domain.onboardSeen) {
			tick().then(() => {
				cardEl?.focus();
			});
		}
	});

	const go = (): void => {
		domain.completeOnboarding();
		ui.setTab('plan');
	};

	const onKeydown = (e: KeyboardEvent): void => {
		if (e.key === 'Escape') go();
	};

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

	// Tune the ride in place — first nudge converts the preset into a
	// persisted custom triple, so results stay curated to these numbers.
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
</script>

{#if !domain.onboardSeen}
	<div
		class="fixed inset-0 z-50 overflow-y-auto"
		style="background: linear-gradient(160deg, var(--app-bg) 0%, var(--color-base-200) 100%);"
	>
		<div
			class="pointer-events-none absolute inset-0"
			style="background-image: linear-gradient(color-mix(in srgb, var(--color-primary) 6%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--color-primary) 6%, transparent) 1px, transparent 1px); background-size: 48px 48px;"
			aria-hidden="true"
		></div>
		<RouteMotif opacity={0.14} />
		<div
			class="relative mx-auto flex min-h-full w-full max-w-sm px-6 py-10"
			role="dialog"
			aria-modal="true"
			aria-labelledby="onboardTitle"
			bind:this={cardEl}
			onkeydown={onKeydown}
			tabindex="-1"
		>
			<div class="m-auto flex w-full flex-col items-center gap-7">
			<div class="anim-slide-up flex flex-col items-center gap-2">
				<Mark name="route" cls="size-10 text-primary" />
				<h1
					id="onboardTitle"
					class="font-display m-0"
					style="font-weight: 700; font-size: 3.25rem; letter-spacing: -0.02em; line-height: 1;"
				>
					<span class="wordmark">GradientRip</span>
				</h1>					<p class="font-mono2 m-0" style="font-size: 0.68rem; letter-spacing: 0.14em; color: var(--ink-2); line-height: 1.5;">
						Plan any route. Know if your board can make it — before you leave.
					</p>
			</div>

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

			<div class="anim-slide-up w-full" style="animation-delay: 0.24s;">
				<SlashButton label="LET'S ROLL →" style="width: 100%;" onclick={go} />
			</div>
		</div>
		</div>
	</div>
{/if}
