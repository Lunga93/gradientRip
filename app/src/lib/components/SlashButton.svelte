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
			'btn',
			variant === 'secondary' ? 'btn-secondary' : variant === 'danger' ? 'btn-error' : 'btn-primary',
			size === 'sm' ? 'btn-sm' : size === 'xs' ? 'btn-xs' : ''
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
