<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';

	let { error }: { error?: { message?: string } | null } = $props();

	const message = $derived(
		error?.message && error.message.length > 0
			? error.message
			: `Something went wrong (${page.status ?? 'unknown error'}).`
	);
</script>

<main class="error-page">
	<ErrorNotice {message} />
	<a class="back-home" href={resolve('/home')}>Back home</a>
</main>

<style>
	.error-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem 1rem;
	}

	.back-home {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--accent);
		font: var(--type-body-strong);
	}
</style>
