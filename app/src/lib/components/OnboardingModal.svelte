<script lang="ts">
	import { domain, BOARD_RANGES } from '$lib/state/domain.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import ModePicker from './ModePicker.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';
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
					class="font-display m-0 text-[3.25rem] leading-none font-bold tracking-tight"
				>
					<span class="wordmark">GradientRip</span>
				</h1>					<p class="font-mono2 m-0 text-[0.68rem] leading-relaxed tracking-[0.14em] text-base-content/70">
						Plan any route. Know if your board can make it — before you leave.
					</p>
			</div>

			<div class="anim-slide-up w-full" style="animation-delay: 0.1s;">
				<div class="mb-2 text-[0.7rem] font-bold tracking-[0.14em] text-base-content/60 uppercase">Choose your ride</div>
				<ModePicker variant="onboard" />
			</div>

			<div class="anim-slide-up card border-base-300 bg-base-100 w-full border shadow-sm" style="animation-delay: 0.18s;">
				<div class="border-base-300 flex items-center justify-between gap-2 border-b px-4 py-3">
					<span class="font-mono2 text-[0.62rem] tracking-[0.14em] text-base-content/60"
						>BOARD CONFIGURATION</span
					>
					<span class="font-mono2 text-primary truncate text-[0.6rem] tracking-[0.1em]">{presetLabel.toUpperCase()}</span>
				</div>
				<div class="flex flex-col gap-2.5 px-4 py-3">
					{#each spec as cfg (cfg.l)}
						<div class="flex items-center gap-2.5">
							<span class="font-mono2 w-24 shrink-0 text-[0.62rem] tracking-[0.08em] text-base-content/60">{cfg.l}</span>
							<progress class="progress progress-primary flex-1" value={Math.min(100, Math.max(4, cfg.pct * 100))} max="100" aria-label={cfg.l}></progress>
							<div class="join shrink-0">
								<button
									type="button"
									class="btn btn-square btn-xs join-item"
									aria-label="Decrease {cfg.l}"
									title="Decrease {cfg.l}"
									onclick={() => nudge(cfg.key, -1)}
								>−</button>
								<span class="font-mono2 text-primary w-16 shrink-0 self-center text-center text-[0.68rem] font-semibold">{cfg.v}</span>
								<button
									type="button"
									class="btn btn-square btn-xs join-item"
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
