<script lang="ts">
	import { onMount } from 'svelte';
	import type { EventSummary } from '$lib/components/EventsView.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';

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
	interface EventDetailData extends Omit<EventSummary, 'going_count'> {
		preview: boolean;
		my_rsvp: string | null;
		route: FullRoute | BlurredRoute | null;
		attendees?: Attendee[];
	}

	let { event, invite = '', onBack }: { event: EventSummary; invite?: string; onBack: () => void } =
		$props();

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
			const res = await fetch(`/api/events/${encodeURIComponent(event.id)}${qs}`);
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
			const res = await fetch(`/api/events/${encodeURIComponent(event.id)}/rsvp`, {
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
			const res = await fetch(`/api/events/${encodeURIComponent(event.id)}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ regenerate_invite: true })
			});
			if (!res.ok) return;
			const data = (await res.json()) as { invite_token: string };
			inviteLink = `${location.origin}/events/${event.id}?invite=${data.invite_token}`;
		} finally {
			regenBusy = false;
		}
	};

	onMount(() => {
		void loadDetail();
	});
</script>

<div class="chamfer-card p-3.5">
	<button
		type="button"
		class="mb-2 cursor-pointer bg-transparent text-[0.78rem]"
		style="border: none; color: var(--ink-2);"
		onclick={onBack}
	>
		← All events
	</button>
	{#if loading}
		<p class="m-0 text-sm" style="color: var(--ink-2);">Loading event…</p>
	{:else if loadError || !detail}
		<p class="m-0 text-sm font-bold" style="color: var(--color-error);" role="alert">
			{loadError || 'Could not load the event.'}
		</p>
	{:else}
		<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">{detail.title}</h3>
		<p class="m-0 mt-1 text-[0.75rem]" style="color: var(--ink-2);">
			{new Date(detail.start_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
			{#if detail.meetup_lat !== null && detail.meetup_lon !== null}
				· {detail.meetup_lat.toFixed(4)}, {detail.meetup_lon.toFixed(4)}
			{/if}
			{#if detail.capacity !== null} · capped at {detail.capacity}{/if}
		</p>

		{#if detail.preview}
			<div
				class="mt-3 rounded-md p-3 text-center text-[0.78rem]"
				style="background: var(--panel-soft); color: var(--ink-2); filter: blur(0);"
			>
				Route preview hidden — join the channel or open the invite link for the full route.
				{#if detail.route && detail.route.preview}
					<span class="mt-1 block text-[0.7rem]">
						Starts near {detail.route.start ? `${detail.route.start[0].toFixed(3)}, ${detail.route.start[1].toFixed(3)}` : 'unknown'}
					</span>
				{/if}
			</div>
		{:else}
			{#if detail.route && !detail.route.preview}
				<p class="m-0 mt-3 text-[0.78rem]" style="color: var(--ink-0);">
					Route: <strong>{detail.route.title}</strong> · {detail.route.line.length} pts
				</p>
			{/if}
			{#if detail.attendees}
				<span class="font-mono2 mt-3 mb-1 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
					WHO'S IN · {counts().going} GOING · {counts().interested} INTERESTED
				</span>
				{#if detail.attendees.length === 0}
					<p class="m-0 text-[0.78rem]" style="color: var(--ink-2);">No RSVPs yet — be the first.</p>
				{:else}
					<ul class="m-0 list-none p-0">
						{#each detail.attendees as a (a.display_name + a.status)}
							<li class="py-0.5 text-[0.8rem]" style="color: var(--ink-0);">
								{a.display_name}
								<span class="text-[0.7rem]" style="color: var(--ink-2);">· {a.status.replace('_', ' ')}</span>
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		{/if}

		<div class="mt-3 flex flex-wrap gap-1.5">
			<SlashButton
				label={rsvpBusy === 'going' ? '…' : 'Going'}
				size="sm"
				onclick={() => void rsvp('going')}
			/>
			<SlashButton
				label={rsvpBusy === 'interested' ? '…' : 'Interested'}
				size="sm"
				onclick={() => void rsvp('interested')}
			/>
			<SlashButton
				label={rsvpBusy === 'cant_go' ? '…' : "Can't go"}
				size="sm"
				onclick={() => void rsvp('cant_go')}
			/>
		</div>
		{#if detail.my_rsvp}
			<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--v-go);" role="status">
				You RSVP'd: {detail.my_rsvp.replace('_', ' ')}
			</p>
		{/if}
		{#if rsvpError}
			<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">
				{rsvpError}
			</p>
		{/if}

		{#if detail.is_member}
			<div class="mt-3">
				<SlashButton
					label={regenBusy ? '…' : inviteLink ? 'Link renewed ✓' : 'New invite link'}
					size="xs"
					onclick={() => void regenerateInvite()}
				/>
				{#if inviteLink}
					<p class="mt-1 mb-0 break-all text-[0.72rem]" style="color: var(--ink-2);">{inviteLink}</p>
				{/if}
			</div>
		{/if}
	{/if}
</div>
