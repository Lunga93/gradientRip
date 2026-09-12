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

	const cls = $derived(
		[
			'slash-btn',
			variant === 'secondary' ? 'slash-btn-secondary' : '',
			variant === 'danger' ? 'slash-btn-danger' : '',
			size === 'sm' ? 'slash-btn-sm' : '',
			size === 'xs' ? 'slash-btn-xs' : ''
		]
			.filter(Boolean)
			.join(' ')
	);
</script>

<button {type} class={cls} {disabled} {style} {title} {onclick}>
	{#if children}
		{@render children()}
	{:else}
		{label}
	{/if}
</button>
