<script lang="ts">
	import { resolve } from '$app/paths';

	// Link mode (explore tabs): every segment carries an href and renders an
	// anchor. In-page tab mode (crew profile): segments carry a value instead
	// and render buttons; the parent owns the tab state via onSelect. The two
	// modes never mix within one control — a segment with an href is a link.
	let {
		segments,
		current,
		onSelect
	}: {
		segments: (
			| { label: string; href: '/explore/routes' | '/explore/crews' | '/explore/events' }
			| { label: string; href?: undefined; value: string }
		)[];
		current: string;
		onSelect?: (value: string) => void;
	} = $props();
</script>

<nav class="segmented" aria-label="Sections">
	{#each segments as segment (segment.label)}
		{@const active = 'href' in segment && segment.href ? segment.href === current : segment.value === current}
		{#if 'href' in segment && segment.href}
			<a
				href={resolve(segment.href)}
				class="segment"
				class:active
				aria-current={active ? 'page' : undefined}
			>
				{segment.label}
			</a>
		{:else}
			<button
				type="button"
				class="segment"
				class:active
				aria-pressed={active}
				onclick={() => onSelect?.(segment.value)}
			>
				{segment.label}
			</button>
		{/if}
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
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-height: 44px;
		text-align: center;
		text-decoration: none;
		padding: 0.5rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
		background: none;
		cursor: pointer;
	}

	.segment:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.segment.active {
		background: var(--surface-raised);
		border-color: var(--line);
		color: var(--text-primary);
	}
</style>
