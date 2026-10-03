<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';

	interface FullRoute {
		id: string;
		title: string;
		preview: false;
		line: [number, number][];
	}
	interface BlurredRoute {
		id: string;
		title: string;
		preview: true;
		start: [number, number] | null;
	}
	interface Attendee {
		status: string;
		display_name: string;
	}
	interface EventDetailData {
		id: string;
		channel_id: string;
		title: string;
		start_at: string;
		meetup_lat: number | null;
		meetup_lon: number | null;
		capacity: number | null;
		created_at: string;
		is_member: boolean;
		preview: boolean;
		my_rsvp: string | null;
		route: FullRoute | BlurredRoute | null;
		attendees?: Attendee[];
	}

	const id = $derived(page.params.id ?? '');
	const invite = $derived(page.url.searchParams.get('invite') ?? '');

	let detail = $state<EventDetailData | null>(null);
	let loading = $state(true);
	let loadError = $state('');
	let rsvpBusy = $state<string | null>(null);
	let rsvpError = $state('');
	let inviteLink = $state('');
	let regenBusy = $state(false);

	const counts = $derived(() => {
		const tally: Record<string, number> = { going: 0, interested: 0, cant_go: 0 };
		for (const a of detail?.attendees ?? []) tally[a.status] = (tally[a.status] ?? 0) + 1;
		return tally;
	});

	const loadDetail = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const qs = invite ? `?invite=${encodeURIComponent(invite)}` : '';
			const res = await fetch(`/api/events/${encodeURIComponent(id)}${qs}`);
			if (!res.ok) {
				loadError = res.status === 404 ? 'Event not found.' : 'Could not load the event.';
				return;
			}
			detail = (await res.json()) as EventDetailData;
		} catch {
			loadError = 'Could not load the event — check your connection.';
		} finally {
			loading = false;
		}
	};

	const rsvp = async (status: string): Promise<void> => {
		if (rsvpBusy) return;
		rsvpBusy = status;
		rsvpError = '';
		try {
			const res = await fetch(`/api/events/${encodeURIComponent(id)}/rsvp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status, ...(invite ? { invite } : {}) })
			});
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				rsvpError = typeof data.message === 'string' ? data.message : 'Could not save your RSVP.';
				return;
			}
			await loadDetail();
		} catch {
			rsvpError = 'Could not save your RSVP — check your connection.';
		} finally {
			rsvpBusy = null;
		}
	};

	const regenerateInvite = async (): Promise<void> => {
		if (regenBusy) return;
		regenBusy = true;
		try {
			const res = await fetch(`/api/events/${encodeURIComponent(id)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ regenerate_invite: true })
			});
			if (!res.ok) return;
			const data = (await res.json()) as { invite_token: string };
			inviteLink = `${location.origin}/events/${id}?invite=${data.invite_token}`;
		} finally {
			regenBusy = false;
		}
	};

	onMount(() => {
		void loadDetail();
	});
</script>

<ScreenHeader title="Event" backHref="/explore/events" />
<div class="detail-body">
	{#if loading && !detail}
		<Skeleton lines={3} />
	{:else if loadError && !detail}
		<ErrorNotice message={loadError} onRetry={() => void loadDetail()} />
	{:else if !detail}
		<ErrorNotice message="Event not found." onRetry={() => void loadDetail()} />
	{:else}
		<div
			class="detail-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<h2 class="detail-title">{detail.title}</h2>
			<p class="detail-meta">
				{new Date(detail.start_at).toLocaleString(undefined, {
					day: 'numeric',
					month: 'short',
					hour: '2-digit',
					minute: '2-digit'
				})}
				{#if detail.meetup_lat !== null && detail.meetup_lon !== null}
					· {detail.meetup_lat.toFixed(4)}, {detail.meetup_lon.toFixed(4)}
				{/if}
				{#if detail.capacity !== null} · capped at {detail.capacity}{/if}
			</p>

			{#if detail.preview}
				<p class="preview-note">
					Route preview hidden — join the channel or open the invite link for the full route.
					{#if detail.route && detail.route.preview}
						<span class="preview-start">
							Starts near {detail.route.start
								? `${detail.route.start[0].toFixed(3)}, ${detail.route.start[1].toFixed(3)}`
								: 'unknown'}
						</span>
					{/if}
				</p>
			{:else}
				{#if detail.route && !detail.route.preview}
					<p class="detail-meta">
						Route: <strong>{detail.route.title}</strong> · {detail.route.line.length} pts
					</p>
				{/if}
				{#if detail.attendees}
					<span class="section-label">
						Who's in · {counts().going} going · {counts().interested} interested
					</span>
					{#if detail.attendees.length === 0}
						<p class="detail-meta">No RSVPs yet — be the first.</p>
					{:else}
						<ul class="attendee-list">
							{#each detail.attendees as a (a.display_name + a.status)}
								<li class="attendee">
									{a.display_name}
									<span class="attendee-status">· {a.status.replace('_', ' ')}</span>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			{/if}

			<div class="detail-actions">
				<SecondaryButton
					label={rsvpBusy === 'going' ? '…' : 'Going'}
					ariaLabel="RSVP going"
					title="RSVP going"
					onclick={() => void rsvp('going')}
				/>
				<SecondaryButton
					label={rsvpBusy === 'interested' ? '…' : 'Interested'}
					ariaLabel="RSVP interested"
					title="RSVP interested"
					onclick={() => void rsvp('interested')}
				/>
				<SecondaryButton
					label={rsvpBusy === 'cant_go' ? '…' : "Can't go"}
					ariaLabel="RSVP can't go"
					title="RSVP can't go"
					onclick={() => void rsvp('cant_go')}
				/>
			</div>
			{#if detail.my_rsvp}
				<p class="status-line" style="color: var(--state-live);" role="status">
					You RSVP'd: {detail.my_rsvp.replace('_', ' ')}
				</p>
			{/if}
			{#if rsvpError}
				<ErrorNotice message={rsvpError} />
			{/if}

			{#if detail.is_member}
				<div class="detail-actions">
					<SecondaryButton
						label={regenBusy ? '…' : inviteLink ? 'Link renewed ✓' : 'New invite link'}
						ariaLabel="Generate a new invite link"
						title="Generate a new invite link"
						onclick={() => void regenerateInvite()}
					/>
				</div>
				{#if inviteLink}
					<p class="invite-link">{inviteLink}</p>
				{/if}
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

	.detail-card {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
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

	.section-label {
		display: block;
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.preview-note {
		margin: 0.5rem 0 0;
		border-radius: var(--radius-sm);
		padding: 0.75rem;
		background: var(--surface-sunken);
		font: var(--type-body);
		color: var(--text-secondary);
		text-align: center;
		align-self: stretch;
	}

	.preview-start {
		display: block;
		margin-top: 0.25rem;
		font: var(--type-label);
	}

	.attendee-list {
		margin: 0;
		padding: 0;
		list-style: none;
		align-self: stretch;
	}

	.attendee {
		padding: 0.125rem 0;
		font: var(--type-body);
		color: var(--text-primary);
	}

	.attendee-status {
		font: var(--type-label);
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

	.invite-link {
		margin: 0.25rem 0 0;
		font: var(--type-label);
		color: var(--text-secondary);
		word-break: break-all;
	}
</style>
