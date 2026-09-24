<script module lang="ts">
	export interface ExploreRoute {
		id: string;
		title: string;
		sport: string;
		line: [number, number][];
		created_at: string;
		rides: number;
		saves: number;
		kudos: number;
		score: number;
		fit: 'fly' | 'ok' | 'caution' | 'stop' | null;
	}
</script>

<script lang="ts">
	import { verdictColor, verdictLabel } from '$lib/verdictTheme.js';
	import SlashButton from '$lib/components/SlashButton.svelte';

	let { route, onBack }: { route: ExploreRoute; onBack: () => void } = $props();

	let saving = $state(false);
	let saved = $state(false);
	let serverSaves = $state<number | null>(null);
	let saveError = $state('');
	const saves = $derived(serverSaves ?? route.saves);

	const fitColor = $derived(route.fit ? verdictColor(route.fit) : 'var(--ink-2)');
	const fitLabel = $derived(route.fit ? verdictLabel(route.fit) : 'UNRATED');

	const saveRoute = async (): Promise<void> => {
		if (saving || saved) return;
		saving = true;
		saveError = '';
		try {
			const res = await fetch(`/api/routes/${route.id}/save`, { method: 'POST' });
			if (!res.ok) {
				saveError = res.status === 401 ? 'Sign in to save routes.' : 'Could not save — try again.';
				return;
			}
			const data = (await res.json()) as { saved: boolean; saves: number };
			saved = true;
			serverSaves = data.saves;
		} catch {
			saveError = 'Could not save — check your connection.';
		} finally {
			saving = false;
		}
	};
</script>

<div class="chamfer-card p-3.5" style="--vt: {fitColor};">
	<button
		type="button"
		class="mb-2 cursor-pointer bg-transparent text-[0.78rem]"
		style="border: none; color: var(--ink-2);"
		onclick={onBack}
	>
		← All routes
	</button>
	<span
		class="font-mono2 mb-2 inline-block rounded-full px-2 py-1"
		style="font-size: 0.62rem; font-weight: 700; letter-spacing: 0.16em; background: color-mix(in srgb, {fitColor} 16%, transparent); color: {fitColor};"
	>
		{fitLabel}
	</span>
	<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">{route.title}</h3>
	<p class="m-0 mt-1 text-[0.75rem]" style="color: var(--ink-2);">
		{route.sport} · {new Date(route.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
	</p>
	<div class="mt-2.5 grid grid-cols-3 gap-2">
		<div class="chamfer-card px-3 py-2 text-center">
			<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{route.rides}</div>
			<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">RIDES</div>
		</div>
		<div class="chamfer-card px-3 py-2 text-center">
			<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{saves}</div>
			<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">SAVES</div>
		</div>
		<div class="chamfer-card px-3 py-2 text-center">
			<div class="font-display text-sm font-bold tabular-nums" style="color: var(--ink-0);">{route.kudos}</div>
			<div class="font-mono2 text-[0.6rem]" style="color: var(--ink-2);">KUDOS</div>
		</div>
	</div>
	{#if saveError}
		<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">{saveError}</p>
	{/if}
	<div class="mt-3">
		<SlashButton label={saved ? 'Saved ✓' : saving ? '…' : 'Save route'} size="sm" onclick={() => void saveRoute()} />
	</div>
</div>
