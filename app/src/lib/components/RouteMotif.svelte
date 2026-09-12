<script lang="ts">
	let { opacity = 0.12 }: { opacity?: number } = $props();

	// Unique per instance — PlanView + ResultsPanel mount simultaneously
	// (hidden views stay in the DOM), so a shared gradient id would collide.
	const gid = `rm-${Math.random().toString(36).slice(2, 9)}`;
</script>

<svg
	class="pointer-events-none absolute inset-0 h-full w-full"
	viewBox="0 0 380 700"
	preserveAspectRatio="xMidYMid slice"
	style="opacity: {opacity};"
	aria-hidden="true"
>
	<defs>
		<linearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
			<stop offset="0%" stop-color="#60a5fa" stop-opacity="0" />
			<stop offset="40%" stop-color="#60a5fa" stop-opacity="1" />
			<stop offset="80%" stop-color="#22d3ee" stop-opacity="1" />
			<stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
		</linearGradient>
	</defs>
	<path
		d="M-20 680 Q 60 580 120 480 Q 200 360 280 260 Q 340 180 420 80"
		fill="none"
		stroke="url(#{gid})"
		stroke-width="1.2"
		stroke-dasharray="5 4"
	/>
</svg>
