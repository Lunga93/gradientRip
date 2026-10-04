<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import { channels } from '$lib/channels.svelte.js';
	import { social } from '$lib/social.svelte.js';

	const id = $derived(page.params.id ?? '');
	const channel = $derived(channels.channelFor(id) ?? null);

	let joining = $state(false);
	let ready = $state(false);

	const join = async (): Promise<void> => {
		if (joining || !channel || channel.is_member) return;
		joining = true;
		await channels.join(channel.id);
		joining = false;
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) void channels.list().then(() => (ready = true));
			else ready = true;
		});
	});
</script>

<ScreenHeader title="Crew" backHref="/explore/crews" />
<div class="detail-body">
	{#if social.me === undefined}
		<p class="detail-checking">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div
			class="signin-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span
				class="font-display signin-badge"
				style="background: var(--surface-sunken); color: var(--accent);"
				aria-hidden="true"
			>
				G
			</span>
			<h2 class="signin-title">Sign in to open this crew</h2>
			<p class="signin-copy">
				Google login unlocks channel membership — anonymous riding keeps working when
				signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="ui-btn ui-btn-primary">Continue with Google</a>
		</div>
	{:else if !channel && !ready}
		<Skeleton lines={3} />
	{:else if !channel}
		<ErrorNotice message="Crew not found." onRetry={() => void channels.list()} />
	{:else}
		<div
			class="detail-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<h2 class="detail-title">{channel.name}</h2>
			<p class="detail-meta">
				{channel.visibility === 'open' ? 'Open channel' : 'Private channel'}
				· {channel.member_count} member{channel.member_count === 1 ? '' : 's'}
				{#if channel.sport} · {channel.sport}{/if}
				{#if channel.home_area} · {channel.home_area}{/if}
			</p>
			{#if !channel.is_member && channel.visibility === 'open'}
				<div class="detail-actions">
					<PrimaryButton
						label={joining ? '…' : 'Join channel'}
						ariaLabel="Join {channel.name}"
						title="Join {channel.name}"
						onclick={() => void join()}
					/>
				</div>
			{:else if channel.is_member}
				<p class="status-line" style="color: var(--state-live);">You are a member.</p>
			{:else}
				<p class="detail-meta">Members-only — ask a member to add you.</p>
			{/if}
			{#if channels.lastError}
				<ErrorNotice message={channels.lastError} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.detail-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.detail-checking {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.signin-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 1.5rem;
		text-align: center;
	}

	.signin-badge {
		display: grid;
		place-items: center;
		width: 3rem;
		height: 3rem;
		font-size: 1.25rem;
		font-weight: 700;
		border-radius: 10px;
	}

	.signin-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.signin-copy {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.detail-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.detail-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.detail-meta {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.detail-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.status-line {
		margin: 0.5rem 0 0;
		font: var(--type-body-strong);
	}

	.ui-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.625rem 1.25rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: var(--type-body-strong);
		letter-spacing: 0.02em;
		cursor: pointer;
		text-decoration: none;
	}

	.ui-btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
	}

	.ui-btn-primary:hover {
		background: var(--accent-hover);
	}
</style>
