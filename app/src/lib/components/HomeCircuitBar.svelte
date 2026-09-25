<script lang="ts">
	import { buildHomeCircuit, CIRCUIT_KMS } from '$lib/circuits.js';
	import { domain } from '$lib/state/domain.svelte.js';
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import SlashButton from '$lib/components/SlashButton.svelte';

	// Null home is null-by-design (onboarding skip allowed) — render nothing.
	let { home }: { home: { lat: number; lon: number; label: string } | null } = $props();

	let km = $state<(typeof CIRCUIT_KMS)[number]>(5);
	let savedKm = $state<number | null>(null);
	let busy = $state(false);
	let status = $state('');
	let publishedId = $state<string | null>(null);

	const circuit = $derived(home ? buildHomeCircuit(home, km, domain.boardVal, domain.modeId) : null);
	const distKm = $derived(circuit ? circuit.cum[circuit.cum.length - 1] / 1000 : 0);
	const level = $derived(circuit?.verdict.level ?? 'ok');
	const vc = $derived(verdictColor(level));
	const fitLabel = $derived(circuit ? verdictLabel(level) : '');
	const canPublish = $derived(savedKm === km && !publishedId);

	const save = (): void => {
		if (!circuit || busy) return;
		busy = true;
		status = '';
		try {
			domain.applyResult(circuit);
			domain.addTrip({
				ts: Date.now(),
				modeId: domain.modeId,
				boardVal: domain.boardVal,
				queries: [`Home circuit ${km} km`],
				coords: circuit.coords,
				line: circuit.line,
				pts: circuit.pts,
				elev: circuit.elev,
				cum: circuit.cum,
				totalWh: circuit.totalWh,
				totalClimb: circuit.totalClimb,
				usableWh: circuit.usableWh,
				climbLimit: circuit.climbLimit,
				brakeLimit: circuit.brakeLimit,
				totalKm: distKm,
				verdictLevel: circuit.verdict.level
			});
			savedKm = km;
			publishedId = null;
			status = 'Saved — publish it to share with the crew.';
		} finally {
			busy = false;
		}
	};

	const publish = async (): Promise<void> => {
		if (!circuit || busy || savedKm !== km) return;
		busy = true;
		status = 'Publishing…';
		try {
			const res = await fetch('/api/routes/publish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: `Home circuit ${km} km`,
					sport: domain.modeId,
					line: circuit.line
				})
			});
			if (res.status === 401) {
				status = 'Sign in to publish routes.';
				return;
			}
			if (!res.ok) {
				status = 'Could not publish — try again.';
				return;
			}
			const data = (await res.json()) as { id?: string; deduped?: boolean };
			if (data.deduped) {
				status = 'Already shared — this line is live in Explore.';
			} else {
				publishedId = data.id ?? null;
				status = 'Published — find it in Explore.';
			}
		} catch {
			status = 'Could not publish — check your connection.';
		} finally {
			busy = false;
		}
	};
</script>

{#if home && circuit}
	<div class="chamfer-card p-3.5" style="--vt: {vc};">
		<span
			class="font-mono2 mb-2 block"
			style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);"
		>
			HOME CIRCUITS · START ~200M FROM HOME
		</span>
		<div class="mb-2.5 flex gap-1.5" role="group" aria-label="Circuit distance">
			{#each CIRCUIT_KMS as opt (opt)}
				<button
					type="button"
					class="board-chip {km === opt ? 'board-chip-active' : ''}"
					aria-pressed={km === opt}
					onclick={() => {
						km = opt;
						status = '';
					}}
				>
					{opt} km
				</button>
			{/each}
		</div>
		<div class="mb-2.5 flex items-center gap-2">
			<span class="text-[0.85rem] font-bold tabular-nums" style="color: var(--ink-0);">
				{distKm.toFixed(1)} km
			</span>
			<span
				class="font-mono2 rounded-full px-2 py-1"
				style="font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, {vc} 16%, transparent); color: {vc};"
			>
				{fitLabel}
			</span>
		</div>
		<p class="m-0 mb-2.5 text-[0.75rem] leading-relaxed" style="color: var(--ink-2);">
			{circuit.verdict.text}
		</p>
		<p class="m-0 mb-2.5 text-[0.7rem] leading-relaxed" style="color: var(--ink-2);">
			Flat estimate — hills not included.
		</p>
		{#if status}
			<p class="m-0 mb-2 text-[0.78rem]" style="color: var(--ink-1);" role="status">{status}</p>
		{/if}
		<div class="flex gap-2">
			<SlashButton
				label={savedKm === km ? 'Saved ✓' : busy ? '…' : 'Save'}
				size="sm"
				disabled={busy}
				onclick={save}
			/>
			<SlashButton
				label={publishedId ? 'Published ✓' : 'Publish'}
				size="sm"
				variant="secondary"
				disabled={busy || !canPublish}
				title={savedKm === km ? 'Share this circuit' : 'Save first, then publish'}
				onclick={() => void publish()}
			/>
		</div>
	</div>
{/if}
