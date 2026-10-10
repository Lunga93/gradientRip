<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import { feed, type FeedComment } from '$lib/feed.svelte.js';
	import {
		COMMENT_MAX,
		MORE_CHARS,
		threadComments,
		videoParts,
		sharePost,
		retryPost,
		deletePost,
		submitPostComment,
		openTripRide,
		type PostCardPost,
		type PostRideTrip,
		type ThreadNode
	} from '$lib/posts.svelte.js';
	import { fmtCount, relTime } from '$lib/ui/format.js';

	let {
		post,
		detail = false,
		comments = [],
		isAuthor = false
	}: {
		post: PostCardPost;
		detail?: boolean;
		comments?: FeedComment[];
		isAuthor?: boolean;
	} = $props();

	const parts = $derived(videoParts(post.media));
	const thread = $derived(threadComments(comments));
	const bodyText = $derived((post.body ?? '').trim());
	const showMore = $derived(!detail && bodyText.length > MORE_CHARS);
	const postHref = $derived(`/post/${post.id}` as `/post/${string}`);
	const title = $derived(bodyText ? bodyText.slice(0, 60) : 'Post');
	// Detail author header mirrors the home card header content: the same
	// display name (nested author first, flat feed field as fallback) and
	// the same relTime(created_at) format. No profile route exists, so this
	// stays non-interactive text — never a fake link.
	const authorName = $derived(
		post.author?.name?.trim() || post.author_name?.trim() || 'Rider'
	);
	const authorAvatar = $derived(post.author?.avatar ?? post.author_avatar ?? null);
	const authorInitial = $derived(((authorName || 'R')[0] || 'R').toUpperCase());
	const authorTime = $derived.by(() => {
		const ts = new Date(post.created_at).getTime();
		return Number.isFinite(ts) ? relTime(ts) : '';
	});

	let kudosBusy = $state(false);
	let kudosMsg = $state('');
	let sharedNote = $state('');
	let quality = $state<'sd' | 'hd'>('sd');
	let reporting = $state(false);
	let reason = $state('');
	let reportBusy = $state(false);
	let reportMsg = $state('');
	let retryBusy = $state(false);
	let retryMsg = $state('');
	let deleteBusy = $state(false);
	let deleteMsg = $state('');
	let composer = $state('');
	let replyTo = $state<{ id: string; name: string } | null>(null);
	let commentBusy = $state(false);
	let commentMsg = $state('');
	let tripMsg = $state('');

	const src = $derived(quality === 'hd' && parts.hd ? parts.hd.url : (parts.sd?.url ?? ''));
	const composerLen = $derived(composer.length);
	const canSubmit = $derived(!commentBusy && composer.trim().length > 0 && composerLen <= COMMENT_MAX);

	const commentTime = (createdAt: string): string => {
		const ts = new Date(createdAt).getTime();
		return Number.isFinite(ts) ? relTime(ts) : '';
	};

	const rideTripLabel = (ride: PostRideTrip): string => {
		const km = typeof ride.total_km === 'number' && Number.isFinite(ride.total_km) ? `${ride.total_km.toFixed(1)} km` : null;
		const date =
			typeof ride.ts === 'number' && Number.isFinite(ride.ts)
				? new Date(ride.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
				: null;
		return ['Trip', km, date].filter((p): p is string => !!p).join(' · ');
	};

	const onKudos = async (): Promise<void> => {
		if (kudosBusy) return;
		kudosBusy = true;
		kudosMsg = '';
		// givePostKudos mutates post.kudos in place (optimistic +1, server
		// reconcile, rollback) — the card renders post.kudos directly, so no
		// local copy to drift. Callers must pass a stable object (home
		// memoizes one per entry) rather than rebuilding it per render.
		const res = await feed.givePostKudos(post);
		if (!res.ok) kudosMsg = res.message;
		kudosBusy = false;
	};

	const onShare = async (): Promise<void> => {
		sharedNote = '';
		const res = await sharePost(post.id, title);
		if (res.copied) sharedNote = res.message;
		else if (!res.ok && res.message) sharedNote = res.message;
	};

	const onReportSend = async (): Promise<void> => {
		if (reportBusy || !reason.trim()) return;
		reportBusy = true;
		reportMsg = '';
		const res = await feed.report('post', post.id, reason.trim());
		reportBusy = false;
		reportMsg = res.message;
		if (res.ok) {
			reporting = false;
			reason = '';
		}
	};

	const onRetry = async (): Promise<void> => {
		if (retryBusy) return;
		retryBusy = true;
		retryMsg = '';
		const res = await retryPost(post.id);
		retryBusy = false;
		retryMsg = res.message;
	};

	const onDelete = async (): Promise<void> => {
		if (deleteBusy) return;
		const confirmed = typeof confirm === 'function' ? confirm('Delete this post? This cannot be undone.') : true;
		if (!confirmed) return;
		deleteBusy = true;
		deleteMsg = '';
		const res = await deletePost(post.id);
		deleteBusy = false;
		if (!res.ok) {
			deleteMsg = res.message;
			return;
		}
		await goto(resolve('/home'));
	};

	const onOpenTrip = async (ride: PostRideTrip): Promise<void> => {
		tripMsg = '';
		const res = await openTripRide(ride);
		if (!res.ok) tripMsg = res.message;
	};

	const onSubmitComment = async (): Promise<void> => {
		if (!canSubmit) return;
		commentBusy = true;
		commentMsg = '';
		const res = await submitPostComment(post.id, composer.trim(), replyTo?.id ?? null);
		commentBusy = false;
		if (!res.ok) {
			commentMsg = res.message;
			return;
		}
		composer = '';
		replyTo = null;
	};
</script>

<div class="post-card">
	{#if detail}
		<div class="post-author">
			{#if authorAvatar}
				<img
					src={authorAvatar}
					alt=""
					width="32"
					height="32"
					class="post-author-avatar"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<span class="post-author-fallback" aria-hidden="true">{authorInitial}</span>
			{/if}
			<span class="post-author-text">
				<span class="post-author-name">{authorName}</span>
				{#if authorTime}
					<span class="post-author-time">· {authorTime}</span>
				{/if}
			</span>
		</div>
	{/if}
	{#if bodyText}
		{#if detail}
			<p class="post-text-full">{bodyText}</p>
		{:else}
			<p class="post-text-clamp">{bodyText}</p>
			{#if showMore}
				<a class="post-more" href={resolve(postHref)}>More</a>
			{/if}
		{/if}
	{/if}

	{#if parts.photos.length === 1 && parts.photos[0]}
		<img class="post-photo-large" src={parts.photos[0].url} alt="Attachment 1 of 1" loading="lazy" />
	{:else if parts.photos.length > 1}
		<div class="post-photo-grid">
			{#each parts.photos as photo, i (photo.url + i)}
				<img
					class="post-photo-cell"
					src={photo.url}
					alt="Attachment {i + 1} of {parts.photos.length}"
					loading="lazy"
				/>
			{/each}
		</div>
	{/if}

	{#if parts.sd && post.status !== 'failed'}
		<div class="post-video">
			<!-- No captions track exists for user uploads: a bare track would be
			     fake UI, so the a11y caption warning here is accepted. Failed posts
			     skip the player entirely — the source never produced playable
			     output, so a dead black box would sit above the failure note. -->
			<video controls preload="metadata" src={src} poster={parts.poster?.url} aria-label="Attached video"></video>
			{#if parts.hd}
				<span class="post-quality">
					<SecondaryButton
						label={quality === 'sd' ? 'Watch in 720p' : 'Watch in 480p'}
						ariaLabel={quality === 'sd' ? 'Switch video to 720p' : 'Switch video to 480p'}
						ariaPressed={quality === 'hd'}
						onclick={() => (quality = quality === 'sd' ? 'hd' : 'sd')}
					/>
				</span>
			{/if}
		</div>
	{/if}

	{#if post.ride}
		{@const ride = post.ride}
		{#if ride.kind === 'route'}
			<div class="ride-card">
				<span class="ride-label">Route · {ride.title ?? 'Untitled'} · {ride.sport ?? 'Route'}</span>
				<SecondaryButton
					label="Open"
					ariaLabel="Open attached route {ride.title ?? ''}"
					title="Open attached route"
					onclick={() => void goto(resolve(`/route/${ride.id}` as `/route/${string}`))}
				/>
			</div>
		{:else}
			<div class="ride-card">
				<span class="ride-label">{rideTripLabel(ride)}</span>
				<SecondaryButton
					label="Open"
					ariaLabel="Open attached trip"
					title="Open attached trip"
					onclick={() => void onOpenTrip(ride)}
				/>
			</div>
			{#if tripMsg}
				<p class="post-note" role="status">{tripMsg}</p>
			{/if}
		{/if}
	{/if}

	{#if post.status === 'processing'}
		<!-- Retry is failed+author ONLY: POST /api/posts/[id]/retry refuses
		     queued/processing with 422 "still being processed", so a Retry
		     button here could only ever produce an error toast — dishonest
		     affordance. Gate strictly instead of visible-but-disabled. -->
		<p class="post-note" role="status">Video is being processed — it will appear here when ready.</p>
	{:else if post.status === 'failed'}
		<p class="post-note" role="alert">Video processing failed.</p>
		{#if isAuthor}
			<span class="post-retry">
				<SecondaryButton
					label={retryBusy ? '…' : 'Retry video'}
					ariaLabel="Retry video processing"
					title="Retry video processing"
					disabled={retryBusy}
					onclick={() => void onRetry()}
				/>
			</span>
		{/if}
	{/if}
	{#if retryMsg}
		<p class="post-note" role="status">{retryMsg}</p>
	{/if}

	<div class="post-actions">
		<SecondaryButton
			label="♥ {fmtCount(post.kudos)}"
			ariaLabel="Give kudos to this post"
			title="Give kudos to this post"
			disabled={kudosBusy}
			onclick={() => void onKudos()}
		/>
		{#if !detail}
			<SecondaryButton
				label="Comment"
				ariaLabel="Comment on this post"
				title="Comment on this post"
				onclick={() => void goto(resolve(postHref))}
			/>
		{/if}
		<SecondaryButton
			label="Share"
			ariaLabel="Share this post"
			title="Share this post"
			onclick={() => void onShare()}
		/>
		<SecondaryButton
			label="Report"
			ariaLabel="Report this post"
			title="Report this post"
			onclick={() => {
				reporting = !reporting;
				reportMsg = '';
			}}
		/>
		{#if detail && isAuthor}
			<SecondaryButton
				label={deleteBusy ? '…' : 'Delete'}
				ariaLabel="Delete this post"
				title="Delete this post"
				disabled={deleteBusy}
				onclick={() => void onDelete()}
			/>
		{/if}
		{#if sharedNote}
			<span class="post-note" role="status">{sharedNote}</span>
		{/if}
		{#if kudosMsg}
			<span class="post-note" role="alert">{kudosMsg}</span>
		{/if}
	</div>

	{#if reporting}
		<form
			class="report-form"
			onsubmit={(e) => {
				e.preventDefault();
				void onReportSend();
			}}
		>
			<label class="report-label" for="post-report-{post.id}">Report reason</label>
			<input
				id="post-report-{post.id}"
				class="report-input"
				type="text"
				maxlength="500"
				placeholder="Why are you reporting this?"
				aria-label="Report reason"
				bind:value={reason}
				disabled={reportBusy}
			/>
			<span class="report-row">
				<SecondaryButton label={reportBusy ? '…' : 'Send report'} type="submit" disabled={reportBusy || !reason.trim()} />
				<SecondaryButton
					label="Cancel"
					ariaLabel="Cancel report"
					onclick={() => {
						reporting = false;
						reason = '';
						reportMsg = '';
					}}
				/>
			</span>
		</form>
	{/if}
	{#if reportMsg && !reporting}
		<p class="post-note" role="status">{reportMsg}</p>
	{/if}
	{#if deleteMsg}
		<p class="post-note" role="alert">{deleteMsg}</p>
	{/if}

	{#if detail}
		{#snippet commentNode(node: ThreadNode, depth: number)}
			<div class={depth > 0 ? 'thread-reply' : 'thread-top'}>
				<p class="comment-meta">
					{node.display_name?.trim() || 'Rider'}{#if commentTime(node.created_at)}&nbsp;·&nbsp;{commentTime(node.created_at)}{/if}
				</p>
				<p class="comment-body">{node.body}</p>
				<span class="comment-reply">
					<SecondaryButton
						label="Reply"
						ariaLabel="Reply to {node.display_name?.trim() || 'Rider'}"
						title="Reply to {node.display_name?.trim() || 'Rider'}"
						onclick={() => {
							replyTo = { id: node.id, name: node.display_name?.trim() || 'Rider' };
						}}
					/>
				</span>
				{#each node.replies as child (child.id)}
					{@render commentNode(child, depth + 1)}
				{/each}
			</div>
		{/snippet}
		<section class="thread" aria-label="Comments">
			<h2 class="thread-title">Comments</h2>
			{#if thread.length === 0}
				<p class="post-note">No comments yet — start the thread.</p>
			{:else}
				{#each thread as node (node.id)}
					{@render commentNode(node, 0)}
				{/each}
			{/if}
			<form
				class="composer"
				onsubmit={(e) => {
					e.preventDefault();
					void onSubmitComment();
				}}
			>
				{#if replyTo}
					<p class="reply-chip" role="status">
						Replying to {replyTo.name}
						<SecondaryButton
							label="×"
							ariaLabel="Cancel reply"
							title="Cancel reply"
							onclick={() => (replyTo = null)}
						/>
					</p>
				{/if}
				<label class="composer-label" for="post-comment-{post.id}">Write a comment</label>
				<textarea
					id="post-comment-{post.id}"
					class="composer-input"
					rows="3"
					maxlength={COMMENT_MAX}
					placeholder={replyTo ? `Reply to ${replyTo.name}…` : 'Write a comment…'}
					aria-label={replyTo ? `Write a reply to ${replyTo.name}` : 'Write a comment'}
					bind:value={composer}
					disabled={commentBusy}
				></textarea>
				<span class="composer-row">
					<span class="composer-counter" aria-live="polite">{composerLen}/{COMMENT_MAX}</span>
					<PrimaryButton label={commentBusy ? '…' : 'Submit comment'} type="submit" disabled={!canSubmit} />
				</span>
			</form>
			{#if commentMsg}
				<p class="post-note" role="alert">{commentMsg}</p>
			{/if}
		</section>
	{/if}
</div>

<style>
	.post-card {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.post-author {
		display: flex;
		align-items: center;
		gap: 0.625rem;
	}

	.post-author-avatar {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.post-author-fallback {
		display: grid;
		place-items: center;
		width: 32px;
		height: 32px;
		flex-shrink: 0;
		border-radius: 9999px;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		color: var(--text-secondary);
		font: var(--type-body-strong);
	}

	.post-author-text {
		display: flex;
		align-items: baseline;
		gap: 0.375rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.post-author-name {
		font: var(--type-body-strong);
		color: var(--text-primary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.post-author-time {
		font: var(--type-meta);
		color: var(--text-secondary);
		flex-shrink: 0;
	}

	.post-text-clamp,
	.post-text-full {
		margin: 0;
		font: var(--type-body);
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.post-text-clamp {
		display: -webkit-box;
		-webkit-line-clamp: 6;
		line-clamp: 6;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.post-more {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		font: var(--type-body-strong);
		color: var(--accent);
		text-decoration: none;
	}

	.post-more:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.post-photo-large {
		width: 100%;
		border-radius: var(--radius-sm);
		object-fit: cover;
	}

	.post-photo-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.375rem;
	}

	.post-photo-cell {
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: var(--radius-sm);
	}

	.post-video {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.post-video video {
		width: 100%;
		border-radius: var(--radius-sm);
		background: #000;
	}

	.post-quality {
		align-self: flex-start;
	}

	.ride-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.625rem;
		padding: 0.625rem 0.75rem;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
	}

	.ride-label {
		font: var(--type-body-strong);
		color: var(--text-primary);
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.post-retry {
		align-self: flex-start;
	}

	.post-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.25rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--line);
	}

	.post-note {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
		align-self: center;
	}

	.report-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem 0.75rem;
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
	}

	.report-label {
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}

	.report-input {
		min-height: 44px;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: var(--type-body);
	}

	.report-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.report-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.thread {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.25rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--line);
	}

	.thread-title {
		margin: 0;
		font: var(--type-body-strong);
		color: var(--text-primary);
	}

	.thread-top {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem 0;
		border-top: 1px solid var(--line);
	}

	.thread-top:first-of-type {
		border-top: none;
		padding-top: 0;
	}

	.thread-reply {
		margin-top: 0.5rem;
		margin-left: 1rem;
		padding-left: 0.625rem;
		border-left: 2px solid var(--line-strong);
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.comment-meta {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.comment-body {
		margin: 0;
		font: var(--type-body);
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.comment-reply {
		align-self: flex-start;
	}

	.composer {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin-top: 0.25rem;
	}

	.reply-chip {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.composer-label {
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
	}

	.composer-input {
		min-height: 44px;
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: var(--type-body);
		resize: vertical;
	}

	.composer-input:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.composer-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.composer-counter {
		font: var(--type-meta);
		color: var(--text-secondary);
	}
</style>
