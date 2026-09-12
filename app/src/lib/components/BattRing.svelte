<script lang="ts">
	let { pct, color, size = 76 }: { pct: number; color: string; size?: number } = $props();

	const r = $derived(size / 2 - 7);
	const c = $derived(2 * Math.PI * r);
	const dash = $derived(Math.max(0, Math.min(100, pct) / 100) * c);
</script>

<div
	class="relative grid shrink-0 place-items-center"
	style="width: {size}px; height: {size}px;"
	role="img"
	aria-label="Battery {Math.round(pct)} percent"
>
	<svg width={size} height={size} class="absolute inset-0" style="transform: rotate(-90deg);">
		<circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--panel-line)" stroke-width="4.5" />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			fill="none"
			stroke={color}
			stroke-width="4.5"
			stroke-dasharray="{dash} {c}"
			stroke-linecap="round"
			style="filter: drop-shadow(0 0 6px {color});"
		/>
	</svg>
	<span
		class="font-mono2"
		style="font-size: {size > 60 ? 11 : 9}px; font-weight: 600; color: {color}; line-height: 1;"
	>
		{Math.round(pct)}%
	</span>
</div>
