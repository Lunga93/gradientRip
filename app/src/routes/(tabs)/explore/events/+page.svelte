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
	import { social } from '$lib/social.svelte.js';
	import { channels } from '$lib/channels.svelte.js';

	interface EventSummary {
		id: string;
		channel_id: string;
		title: string;
		start_at: string;
		meetup_lat: number | null;
		meetup_lon: number | null;
		route_id: string | null;
		capacity: number | null;
		created_at: string;
		is_member: boolean;
		going_count: number;
	}

	const SEGMENTS: { label: string; href: '/explore/routes' | '/explore/crews' | '/explore/events' }[] = [
		{ label: 'Routes', href: '/explore/routes' },
		{ label: 'Crews', href: '/explore/crews' },
		{ label: 'Events', href: '/explore/events' }
	];

	let events = $state<EventSummary[]>([]);
	let loading = $state(false);
	let loadError = $state('');
	let title = $state('');
	let channelId = $state('');
	let startAt = $state('');
	let creating = $state(false);
	let createError = $state('');
	let createdMsg = $state('');

	const eventMeta = (startAt: string, goingCount: number, isMember: boolean): string => {
		const when = new Date(startAt).toLocaleString(undefined, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
		const going = `${goingCount} going`;
		return isMember ? `${when} · ${going}` : `${when} · ${going} · preview`;
	};

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const res = await fetch('/api/events');
			if (!res.ok) {
				loadError = res.status === 401 ? 'Sign in to see events.' : 'Could not load events.';
				return;
			}
			const data = (await res.json()) as { events: EventSummary[] };
			events = data.events;
		} catch {
			loadError = 'Could not load events — check your connection.';
		} finally {
			loading = false;
		}
	};

	const createEvent = async (): Promise<void> => {
		if (!title.trim() || !channelId || !startAt || creating) return;
		creating = true;
		createError = '';
		createdMsg = '';
		try {
			const res = await fetch('/api/events', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ channel_id: channelId, title: title.trim(), start_at: startAt })
			});
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				createError = typeof data.message === 'string' ? data.message : 'Could not create the event.';
				return;
			}
			title = '';
			startAt = '';
			createdMsg = 'Event created.';
			await load();
		} catch {
			createError = 'Could not create the event — check your connection.';
		} finally {
			creating = false;
		}
	};

	const openEvent = (id: string): void => {
		void goto(resolve(`/event/${id}`));
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) {
				void channels.list();
				void load();
			}
		});
	});
</script>

<ScreenHeader title="Explore" />
<div class="explore-body">
	<SegmentedControl segments={SEGMENTS} current="/explore/events" />
	{#if social.me === undefined}
		<p class="explore-checking">Checking sign-in…</p>
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
			<h2 class="signin-title">Sign in to join events</h2>
			<p class="signin-copy">
				Google login unlocks RSVPs — anonymous riding keeps working when signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="ui-btn ui-btn-primary">Continue with Google</a>
		</div>
	{:else}
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<span class="section-label">Plan an event</span>
			<form
				class="create-form"
				onsubmit={(e) => {
					e.preventDefault();
					void createEvent();
				}}
			>
				<input
					type="text"
					required
					maxlength="80"
					placeholder="e.g. Sunrise Loop"
					bind:value={title}
					aria-label="Event title"
					class="field min-w-0 flex-1"
				/>
				<div class="create-row">
					<select bind:value={channelId} required aria-label="Channel" class="field min-w-0 flex-1">
						<option value="">Channel…</option>
						{#each channels.mine as ch (ch.id)}
							<option value={ch.id}>{ch.name}</option>
						{/each}
					</select>
					<input
						type="datetime-local"
						required
						bind:value={startAt}
						aria-label="Start time"
						class="field min-w-0 flex-1"
					/>
					<PrimaryButton label={creating ? '…' : 'Create'} type="submit" />
				</div>
			</form>
			{#if createError}
				<ErrorNotice message={createError} />
			{/if}
			{#if createdMsg}
				<p class="sent-msg" style="color: var(--state-live);" role="status">{createdMsg}</p>
			{/if}
		</div>
		{#if loading && events.length === 0}
			<Skeleton lines={3} />
		{:else if loadError}
			<ErrorNotice message={loadError} onRetry={() => void load()} />
		{:else if events.length === 0}
			<EmptyState
				title="No events yet"
				body="Plan the first group ride above — channel members can RSVP."
			/>
		{:else}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Upcoming · {events.length}</span>
				<div class="stack">
					{#each events as ev (ev.id)}
						<ListRow title={ev.title} meta={eventMeta(ev.start_at, ev.going_count, ev.is_member)}>
							{#snippet trailing()}
								<span class="row-actions">
									{#if ev.is_member}
										<StateBadge label="MEMBER" tone="go" />
									{/if}
									<SecondaryButton
										label="Open"
										ariaLabel="Open {ev.title}"
										title="Open {ev.title}"
										onclick={() => openEvent(ev.id)}
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
