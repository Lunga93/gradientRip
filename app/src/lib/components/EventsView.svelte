<script module lang="ts">
	export interface EventSummary {
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
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { social } from '$lib/social.svelte.js';
	import { channels } from '$lib/channels.svelte.js';
	import EventDetail from '$lib/components/EventDetail.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';

	let events = $state<EventSummary[]>([]);
	let loading = $state(false);
	let loadError = $state('');
	let title = $state('');
	let channelId = $state('');
	let startAt = $state('');
	let creating = $state(false);
	let createError = $state('');
	let createdMsg = $state('');
	let selectedId = $state<string | null>(null);

	const selected = $derived(selectedId ? (events.find((e) => e.id === selectedId) ?? null) : null);

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

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) {
				void channels.list();
				void load();
			}
		});
	});
</script>

<div class="view active p-5">
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold" style="color: var(--ink-0);">Events</h2>
	<p class="m-0 mb-4 text-[0.8rem]" style="color: var(--ink-2);">
		Group rides — members and invite-link holders see the full route and who's going.
	</p>

	{#if social.me === undefined}
		<p class="text-sm" style="color: var(--ink-2);">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div class="chamfer-card flex flex-col items-center gap-3 p-6 text-center">
			<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">
				Sign in to join events
			</h3>
			<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
				Google login unlocks RSVPs — anonymous riding keeps working when signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="slash-btn slash-btn-sm no-underline" style="text-decoration: none;">
				Continue with Google
			</a>
		</div>
	{:else if selected}
		<EventDetail event={selected} onBack={() => (selectedId = null)} />
	{:else}
		<div class="chamfer-card mb-3 p-3.5">
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
				PLAN AN EVENT
			</span>
			<form
				class="flex flex-col gap-1.5"
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
					class="min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm"
					style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
				/>
				<div class="flex items-center gap-1.5">
					<select
						bind:value={channelId}
						required
						aria-label="Channel"
						class="min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm"
						style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
					>
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
						class="min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm"
						style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
					/>
					<SlashButton label={creating ? '…' : 'Create'} size="sm" type="submit" />
				</div>
			</form>
			{#if createError}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">
					{createError}
				</p>
			{/if}
			{#if createdMsg}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--v-go);" role="status">{createdMsg}</p>
			{/if}
		</div>

		{#if loading && events.length === 0}
			<p class="text-sm" style="color: var(--ink-2);">Loading events…</p>
		{:else if loadError}
			<p class="text-sm font-bold" style="color: var(--color-error);" role="alert">{loadError}</p>
		{:else if events.length === 0}
			<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
				<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">No events yet</h3>
				<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
					Plan the first group ride above — channel members can RSVP.
				</p>
			</div>
		{:else}
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
				UPCOMING · {events.length}
			</span>
			<div class="flex flex-col gap-2.5">
				{#each events as ev (ev.id)}
					<div class="chamfer-card p-3.5">
						<div class="flex items-center gap-2.5">
							<button
								type="button"
								class="min-w-0 flex-1 cursor-pointer bg-transparent text-left"
								style="border: none;"
								onclick={() => (selectedId = ev.id)}
								title="Open {ev.title}"
							>
								<span class="block truncate text-[0.95rem] font-bold" style="color: var(--ink-0);">
									{ev.title}
								</span>
								<span class="block text-[0.7rem]" style="color: var(--ink-2);">
									{new Date(ev.start_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
									· {ev.going_count} going
									{#if !ev.is_member} · preview{/if}
								</span>
							</button>
							{#if ev.is_member}
								<span
									class="font-mono2 shrink-0 rounded-full px-2 py-1"
									style="font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, var(--v-go) 16%, transparent); color: var(--v-go);"
								>
									MEMBER
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>
