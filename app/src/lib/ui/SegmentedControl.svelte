<script lang="ts">
	let {
		segments,
		current
	}: {
		segments: { label: string; href: string }[];
		current: string;
	} = $props();
</script>

<nav class="segmented" aria-label="Sections">
	{#each segments as segment (segment.href)}
		{@const active = segment.href === current}
		<a
			href={segment.href}
			class="segment"
			class:active
			aria-current={active ? 'page' : undefined}
		>
			{segment.label}
		</a>
	{/each}
</nav>

<style>
	.segmented {
		display: flex;
		gap: 0.25rem;
		padding: 0.25rem;
		background: var(--surface-sunken);
		border-radius: var(--radius-md);
	}

	.segment {
		flex: 1 1 0;
		text-align: center;
		text-decoration: none;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}

	.segment.active {
		background: var(--surface-raised);
		border-color: var(--line);
		color: var(--text-primary);
	}
</style>
