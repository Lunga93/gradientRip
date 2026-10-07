<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import { loadPost, loadPostComments, type PostDetail } from '$lib/posts.svelte.js';
	import { feed } from '$lib/feed.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	const id = $derived(page.params.id ?? '');

	let post = $state<PostDetail | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let notFound = $state(false);

	const comments = $derived(feed.commentsFor(id));
	const isAuthor = $derived(!!post && !!social.me && post.author?.id === social.me.id);

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		notFound = false;
		post = null;
		const res = await loadPost(id);
		if (!res.ok) {
			if (res.message === 'Post not found.') notFound = true;
			else loadError = res.message;
			loading = false;
			return;
		}
		post = res.post ?? null;
		loading = false;
		// Thread loads after the card so the post paints first; failures stay
		// silent here — the composer surfaces errors on submit.
		await loadPostComments(id);
	};

	onMount(() => {
		void social.probeMe();
		void load();
	});
</script>

<ScreenHeader title="Post" backHref="/home" />
<div class="post-detail-body">
	{#if loading && !post && !notFound}
		<Skeleton lines={3} />
	{:else if loadError && !post}
		<ErrorNotice message={loadError} onRetry={() => void load()} />
	{:else if notFound || !post}
		<EmptyState
			title="Post not found"
			body="This post may have been deleted or is not visible to you."
			actionLabel="Back home"
			onAction={() => void goto(resolve('/home'))}
		/>
	{:else}
		<PostCard post={post} detail={true} comments={comments} isAuthor={isAuthor} />
	{/if}
</div>

<style>
	.post-detail-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}
</style>
