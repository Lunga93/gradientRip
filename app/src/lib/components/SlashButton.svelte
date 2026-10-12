<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		label?: string;
		variant?: 'primary' | 'secondary' | 'danger';
		size?: 'md' | 'sm' | 'xs';
		type?: 'button' | 'submit';
		disabled?: boolean;
		style?: string;
		title?: string;
		onclick?: (e: MouseEvent) => void;
		children?: Snippet;
	}

	let {
		label,
		variant = 'primary',
		size = 'md',
		type = 'button',
		disabled = false,
		style = '',
		title,
		onclick,
		children
	}: Props = $props();
</script>

<button
	{type}
	class="slash-btn slash-btn-{variant} slash-btn-{size}"
	{disabled}
	style={style || undefined}
	{title}
	{onclick}
>
	{#if children}
		{@render children()}
	{:else}
		{label}
	{/if}
</button>

<style>
	.slash-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		border: none;
		cursor: pointer;
		font: var(--type-body-strong);
		border-radius: var(--radius-md);
		min-height: 44px;
		padding: 0 1.125rem;
	}
	.slash-btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.slash-btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
	}
	.slash-btn-secondary {
		background: transparent;
		color: var(--text-secondary);
		box-shadow: inset 0 0 0 1px var(--line-strong);
	}
	.slash-btn-danger {
		background: var(--state-stop);
		color: var(--text-on-accent);
	}
	.slash-btn-sm {
		min-height: 40px;
		padding: 0 0.875rem;
		font: var(--type-meta);
		font-weight: 600;
	}
	.slash-btn-xs {
		min-height: 32px;
		padding: 0 0.625rem;
		font: var(--type-label);
	}
	.slash-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
