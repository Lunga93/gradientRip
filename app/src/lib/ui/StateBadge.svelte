<script lang="ts">
	let {
		label,
		tone
	}: {
		label: string;
		tone: 'accent' | 'go' | 'caution' | 'stop' | 'neutral';
	} = $props();
</script>

<span class="badge" data-tone={tone}>{label}</span>

<style>
	.badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		border: 1px solid transparent;
		font: var(--type-label);
		letter-spacing: 0.02em;
	}

	.badge[data-tone='accent'] {
		background: var(--accent);
		color: var(--text-on-accent);
	}

	.badge[data-tone='go'] {
		background: var(--state-go);
		color: var(--text-on-accent);
	}

	.badge[data-tone='caution'] {
		background: var(--state-caution);
		color: var(--text-on-accent);
	}

	.badge[data-tone='stop'] {
		background: var(--state-stop);
		color: var(--text-on-accent);
	}

	.badge[data-tone='neutral'] {
		background: var(--surface-sunken);
		border-color: var(--line);
		color: var(--text-secondary);
	}
</style>
