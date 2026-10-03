<script lang="ts">
	import { onMount } from 'svelte';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { social, friendName } from '$lib/social.svelte.js';
	import { feed, type FeedNotification } from '$lib/feed.svelte.js';
	import { relTime } from '$lib/ui/format.js';

	let email = $state('');
	let sending = $state(false);
	let sentMsg = $state('');

	const sendRequest = async (): Promise<void> => {
		if (!email.trim() || sending) return;
		sending = true;
		sentMsg = '';
		const res = await social.sendRequest(email.trim());
		sending = false;
		if (res.ok) {
			email = '';
			sentMsg = res.message;
		}
	};

	const notificationTitle = (n: FeedNotification): string => n.actor_name?.trim() || 'Someone';

	const notificationMeta = (n: FeedNotification): string => {
		const ts = new Date(n.created_at).getTime();
		const when = Number.isFinite(ts) ? relTime(ts) : '';
		const what = n.kind === 'reply' ? 'Replied to your comment' : 'Commented on your post';
		return when ? `${what} · ${when}` : what;
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) void feed.loadNotifications();
		});
	});

	$effect(() => {
		if (social.signedIn) void feed.loadNotifications();
	});
</script>

<ScreenHeader title="Activity" />
<div class="activity-body">
	{#if social.me === undefined}
		<p class="activity-checking">Checking sign-in…</p>
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
			<h2 class="signin-title">Sign in to see activity</h2>
			<p class="signin-copy">
				Google login links your saved trips to a real identity — nothing is lost, and
				anonymous riding keeps working when signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="ui-btn ui-btn-primary">Continue with Google</a>
		</div>
	{:else}
		<!-- add friend -->
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">ADD A RIDING BUDDY</span>
			<form
				class="flex gap-1.5"
				onsubmit={(e) => {
					e.preventDefault();
					void sendRequest();
				}}
			>
				<input
					type="email"
					required
					placeholder="buddy@gmail.com"
					autocomplete="email"
					bind:value={email}
					aria-label="Friend's Google email"
					class="buddy-input min-w-0 flex-1"
					style="background: var(--surface-sunken); color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--line);"
				/>
				<PrimaryButton label={sending ? '…' : 'Add'} type="submit" />
			</form>
			{#if social.lastError}
				<div class="mt-2"><ErrorNotice message={social.lastError} /></div>
			{/if}
			{#if sentMsg}
				<p class="sent-msg" style="color: var(--state-live);" role="status">{sentMsg}</p>
			{/if}
			{#if social.outgoing.length > 0}
				<p class="m-0 mt-2" style="font: var(--type-label); color: var(--text-secondary);">
					Waiting on: {social.outgoing.map((o) => friendName(o)).join(', ')}
				</p>
			{/if}
		</div>

		<!-- incoming requests -->
		{#if social.incoming.length > 0}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label" style="color: var(--state-caution);">
					REQUESTS · {social.incoming.length}
				</span>
				<div class="stack">
					{#each social.incoming as req (req.id)}
						<ListRow title={friendName(req)}>
							{#snippet avatar()}
								{#if req.avatar_url}
									<img
										src={req.avatar_url}
										alt=""
										width="32"
										height="32"
										class="avatar-32"
										referrerpolicy="no-referrer"
									/>
								{/if}
							{/snippet}
							{#snippet trailing()}
								<span class="request-actions">
									<SecondaryButton
										label="Accept"
										ariaLabel="Accept {friendName(req)}"
										title="Accept {friendName(req)}"
										onclick={() => social.respond(req.id, true)}
									/>
									<button
										type="button"
										class="icon-btn"
										style="border: 1px solid var(--line); color: var(--text-secondary);"
										aria-label="Decline {friendName(req)}"
										onclick={() => social.respond(req.id, false)}
									>
										<Mark name="x" cls="size-3" />
									</button>
								</span>
							{/snippet}
						</ListRow>
					{/each}
				</div>
			</div>
		{/if}

		<!-- notifications -->
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">
				NOTIFICATIONS{#if feed.unread > 0} · {feed.unread} UNREAD{/if}
			</span>
			{#if feed.notifications.length === 0}
				<p class="m-0" style="font: var(--type-body); color: var(--text-secondary);">
					You're all caught up.
				</p>
			{:else}
				<div class="stack">
					{#each feed.notifications as n (n.id)}
						<ListRow title={notificationTitle(n)} meta={notificationMeta(n)}>
							{#snippet avatar()}
								{#if n.actor_avatar}
									<img
										src={n.actor_avatar}
										alt=""
										width="32"
										height="32"
										class="avatar-32"
										referrerpolicy="no-referrer"
									/>
								{/if}
							{/snippet}
							{#snippet trailing()}
								{#if !n.read_at}
									<span
										class="unread-pill"
										style="background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent);"
									>
										NEW
									</span>
								{/if}
							{/snippet}
						</ListRow>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.activity-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.activity-checking {
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

	.buddy-input {
		border: none;
		border-radius: var(--radius-sm);
		padding: 0.625rem 0.75rem;
		font: var(--type-body);
		min-height: 44px;
	}

	.buddy-input::placeholder {
		color: var(--text-tertiary);
	}

	.sent-msg {
		margin: 0;
		margin-top: 0.5rem;
		font: var(--type-body-strong);
	}

	.request-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.icon-btn {
		display: inline-grid;
		place-items: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.375rem;
		background: transparent;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}

	.avatar-32 {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.unread-pill {
		border-radius: 9999px;
		padding: 0.25rem 0.5rem;
		font: var(--type-label);
		flex-shrink: 0;
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
