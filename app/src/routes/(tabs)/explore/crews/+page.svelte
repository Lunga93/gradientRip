<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import { channels } from '$lib/channels.svelte.js';
	import { social } from '$lib/social.svelte.js';

	const SEGMENTS: { label: string; href: '/explore/routes' | '/explore/crews' | '/explore/events' }[] = [
		{ label: 'Routes', href: '/explore/routes' },
		{ label: 'Crews', href: '/explore/crews' },
		{ label: 'Events', href: '/explore/events' }
	];

	let name = $state('');
	let visibility = $state<'open' | 'private'>('open');
	let creating = $state(false);
	let createdMsg = $state('');

	const crewMeta = (
		visibility: 'open' | 'private',
		memberCount: number,
		sport: string | null
	): string => {
		const access = visibility === 'open' ? 'Open' : 'Private';
		const members = `${memberCount} member${memberCount === 1 ? '' : 's'}`;
		return sport ? `${access} · ${members} · ${sport}` : `${access} · ${members}`;
	};

	const createChannel = async (): Promise<void> => {
		if (!name.trim() || creating) return;
		creating = true;
		createdMsg = '';
		const res = await channels.create(name.trim(), visibility);
		creating = false;
		if (res.ok) {
			name = '';
			createdMsg = res.message;
		}
	};

	const openCrew = (id: string): void => {
		void goto(resolve(`/crew/${id}`));
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) void channels.list();
		});
	});
</script>

<ScreenHeader title="Explore" />
<div class="explore-body">
	<SegmentedControl segments={SEGMENTS} current="/explore/crews" />
	{#if social.me === undefined}
		<p class="explore-checking">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div
			class="signin-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span
				class="font-display signin-badge"
				style="background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);"
				aria-hidden="true"
			>
				G
			</span>
			<h2 class="signin-title">Sign in to join channels</h2>
			<p class="signin-copy">
				Google login unlocks channel membership — anonymous riding keeps working when
				signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="ui-btn ui-btn-primary">Continue with Google</a>
		</div>
	{:else}
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">Start a channel</span>
			<form
				class="create-form"
				onsubmit={(e) => {
					e.preventDefault();
					void createChannel();
				}}
			>
				<input
					type="text"
					required
					maxlength="60"
					placeholder="e.g. Dawn Patrol"
					bind:value={name}
					aria-label="Channel name"
					class="field min-w-0 flex-1"
				/>
				<div class="create-row">
					<select bind:value={visibility} aria-label="Channel visibility" class="field min-w-0 flex-1">
						<option value="open">Open — anyone can read & join</option>
						<option value="private">Private — members only</option>
					</select>
					<PrimaryButton label={creating ? '…' : 'Create'} type="submit" />
				</div>
			</form>
			{#if channels.lastError}
				<ErrorNotice message={channels.lastError} />
			{/if}
			{#if createdMsg}
				<p class="sent-msg" style="color: var(--state-live);" role="status">{createdMsg}</p>
			{/if}
		</div>
		{#if channels.loading && channels.count === 0}
			<Skeleton lines={3} />
		{:else if channels.count === 0}
			<EmptyState
				title="No channels yet"
				body="Start the first crew channel above — open channels are visible to every rider."
			/>
		{:else}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Channels · {channels.count}</span>
				<div class="stack">
					{#each channels.channels as ch (ch.id)}
						<ListRow title={ch.name} meta={crewMeta(ch.visibility, ch.member_count, ch.sport)}>
							{#snippet trailing()}
								<span class="row-actions">
									{#if ch.is_member}
										<StateBadge label="MEMBER" tone="go" />
									{:else if ch.visibility === 'open'}
										<SecondaryButton
											label="Join"
											ariaLabel="Join {ch.name}"
											title="Join {ch.name}"
											onclick={() => void channels.join(ch.id)}
										/>
									{/if}
									<SecondaryButton
										label="Open"
										ariaLabel="Open {ch.name}"
										title="Open {ch.name}"
										onclick={() => openCrew(ch.id)}
									/>
								</span>
							{/snippet}
						</ListRow>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.explore-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.explore-checking {
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

	.section-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.section-label {
		display: block;
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.stack {
		display: flex;
		flex-direction: column;
	}

	.create-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.create-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
	}

	.field {
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.625rem 0.75rem;
		font: var(--type-body);
		background: var(--surface-sunken);
		color: var(--text-primary);
		box-shadow: inset 0 0 0 1px var(--line);
		min-height: 44px;
	}

	.field::placeholder {
		color: var(--text-tertiary);
	}

	.sent-msg {
		margin: 0.5rem 0 0;
		font: var(--type-body-strong);
	}

	.row-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
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
