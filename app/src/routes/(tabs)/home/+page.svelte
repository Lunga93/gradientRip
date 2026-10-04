<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import FeedItem from '$lib/ui/FeedItem.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import { social } from '$lib/social.svelte.js';
	import { relTime, fmtCount } from '$lib/ui/format.js';
	import { verdictLabel } from '$lib/verdictTheme.js';

	interface HomeFeedEntry {
		kind: 'activity' | 'route' | 'event';
		id: string;
		title: string;
		kudos: number;
		created_at: string;
		sport: string | null;
		saves: number;
		rides: number;
		fit: 'fly' | 'ok' | 'caution' | 'stop' | null;
		start_at: string | null;
		going_count: number;
		channel: string | null;
		author_name: string | null;
		author_avatar: string | null;
	}

	let entries = $state<HomeFeedEntry[]>([]);
	let checking = $state(true);
	let loading = $state(false);
	let loadError = $state('');
	let signedOut = $state(false);
	let kudosBusy = $state<string | null>(null);
	let actionError = $state('');
	let sharedId = $state<string | null>(null);
	let rsvpBusy = $state<string | null>(null);
	let rsvpDone = $state<Record<string, boolean>>({});
	let rsvpErrors = $state<Record<string, string>>({});

	const detailHref = (entry: HomeFeedEntry): `/route/${string}` | `/event/${string}` | null => {
		if (entry.kind === 'route') return `/route/${entry.id}`;
		if (entry.kind === 'event') return `/event/${entry.id}`;
		return null;
	};

	const sourceLine = (entry: HomeFeedEntry): string => {
		if (entry.kind === 'route') return entry.author_name?.trim() || entry.sport || 'Community route';
		if (entry.kind === 'event') return entry.channel || entry.author_name?.trim() || 'Event';
		return 'Activity update';
	};

	const entryTime = (entry: HomeFeedEntry): string => {
		const ts = new Date(entry.created_at).getTime();
		return Number.isFinite(ts) ? relTime(ts) : '';
	};

	const eventWhen = (startAt: string): string =>
		new Date(startAt).toLocaleString(undefined, {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});

	const fitTone = (fit: HomeFeedEntry['fit']): 'accent' | 'go' | 'caution' | 'stop' | 'neutral' => {
		if (fit === 'fly') return 'accent';
		if (fit === 'ok') return 'go';
		if (fit === 'caution') return 'caution';
		if (fit === 'stop') return 'stop';
		return 'neutral';
	};

	const fitLabel = (fit: HomeFeedEntry['fit']): string => (fit ? verdictLabel(fit) : 'UNRATED');

	const avatarInitial = (entry: HomeFeedEntry): string =>
		((entry.author_name || 'R')[0] || 'R').toUpperCase();

	// Auth probe with an honest offline branch: a failed probe means
	// "unknown", not "signed out" — the feed fetch below then decides
	// (401 → signed-out EmptyState, network failure → ErrorNotice+retry).
	// social.probeMe() still runs for shared store freshness.
	const probeAuth = async (): Promise<'in' | 'out' | 'unknown'> => {
		try {
			const res = await fetch('/api/auth/me');
			if (!res.ok) return 'out';
			const data = (await res.json()) as { user: unknown };
			return data.user ? 'in' : 'out';
		} catch {
			return 'unknown';
		}
	};

	const load = async (): Promise<void> => {
		loading = true;
		loadError = '';
		try {
			const res = await fetch('/api/feed');
			if (res.status === 401) {
				signedOut = true;
				entries = [];
				return;
			}
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json()) as { items: HomeFeedEntry[] };
			entries = Array.isArray(data.items) ? data.items : [];
		} catch {
			loadError = 'Could not load the feed — check your connection.';
		} finally {
			loading = false;
		}
	};

	const giveKudos = async (entry: HomeFeedEntry): Promise<void> => {
		if (kudosBusy) return;
		kudosBusy = entry.id;
		actionError = '';
		entry.kudos += 1;
		try {
			const res = await fetch(`/api/routes/${encodeURIComponent(entry.id)}/kudos`, {
				method: 'POST'
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = (await res.json().catch(() => ({}))) as { kudos?: number };
			if (typeof data.kudos === 'number' && Number.isFinite(data.kudos)) {
				entry.kudos = data.kudos;
			}
		} catch {
			entry.kudos -= 1;
			actionError = 'Could not send kudos — try again.';
		} finally {
			kudosBusy = null;
		}
	};

	const shareEntry = async (entry: HomeFeedEntry): Promise<void> => {
		const href = detailHref(entry);
		if (!href) return;
		const url = new URL(resolve(href), location.origin).href;
		try {
			if (navigator.share) {
				await navigator.share({ title: entry.title, url });
				return;
			}
			await navigator.clipboard.writeText(url);
			sharedId = entry.id;
			setTimeout(() => {
				if (sharedId === entry.id) sharedId = null;
			}, 3000);
		} catch {
			/* share sheet dismissed or clipboard denied — stay silent */
		}
	};

	const rsvpGoing = async (entry: HomeFeedEntry): Promise<void> => {
		if (rsvpBusy || rsvpDone[entry.id]) return;
		rsvpBusy = entry.id;
		rsvpErrors = { ...rsvpErrors, [entry.id]: '' };
		try {
			const res = await fetch(`/api/events/${encodeURIComponent(entry.id)}/rsvp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ status: 'going' })
			});
			const data = (await res.json().catch(() => ({}))) as { message?: string };
			if (!res.ok) {
				rsvpErrors = {
					...rsvpErrors,
					[entry.id]:
						typeof data.message === 'string' ? data.message : 'Could not save your RSVP.'
				};
				return;
			}
			rsvpDone = { ...rsvpDone, [entry.id]: true };
			entry.going_count += 1;
		} catch {
			rsvpErrors = {
				...rsvpErrors,
				[entry.id]: 'Could not save your RSVP — check your connection.'
			};
		} finally {
			rsvpBusy = null;
		}
	};

	onMount(() => {
		void social.probeMe();
		void probeAuth().then((auth) => {
			checking = false;
			if (auth === 'out') {
				signedOut = true;
				return;
			}
			void load();
		});
	});
</script>

<ScreenHeader title="Home" />
<div class="home-body">
	{#if checking}
		<p class="home-checking">Checking sign-in…</p>
	{:else if loading && entries.length === 0 && !signedOut}
		<Skeleton lines={3} />
	{:else if signedOut}
		<EmptyState
			title="See what the crew is riding"
			body="Sign in to catch route drops, kudos and upcoming group rides."
			actionLabel="Sign in"
			onAction={() => goto(resolve('/me'))}
		/>
	{:else if loadError && entries.length === 0}
		<ErrorNotice message={loadError} onRetry={() => void load()} />
	{:else if entries.length === 0}
		<EmptyState
			title="The feed is quiet"
			body="Published routes and upcoming events will land here."
		/>
	{:else}
		{#each entries as entry (entry.kind + entry.id)}
			{@const href = detailHref(entry)}
			{#snippet entryActions()}
				{#if entry.kind === 'route'}
					<SecondaryButton
						label="♥ {fmtCount(entry.kudos)}"
						ariaLabel="Give kudos to {entry.title}"
						title="Give kudos to {entry.title}"
						disabled={kudosBusy === entry.id}
						onclick={() => void giveKudos(entry)}
					/>
				{/if}
				{#if href}
					<SecondaryButton
						label="Share"
						ariaLabel="Share {entry.title}"
						title="Share {entry.title}"
						onclick={() => void shareEntry(entry)}
					/>
				{/if}
				{#if sharedId === entry.id}
					<span class="feed-note" role="status">Link copied</span>
				{/if}
				{#if actionError}
					<span class="feed-note">{actionError}</span>
				{/if}
			{/snippet}
			<FeedItem actions={entry.kind !== 'activity' ? entryActions : undefined}>
				{#snippet header()}
					{#if entry.author_avatar}
						<img
							src={entry.author_avatar}
							alt=""
							width="32"
							height="32"
							class="feed-avatar"
							referrerpolicy="no-referrer"
						/>
					{:else}
						<span class="feed-avatar-fallback" aria-hidden="true">{avatarInitial(entry)}</span>
					{/if}
					<span class="feed-head-text">
						{#if href}
							<a class="feed-title" href={resolve(href)}>{entry.title}</a>
						{:else}
							<span class="feed-title">{entry.title}</span>
						{/if}
						<span class="feed-sub">
							{sourceLine(entry)}{#if entryTime(entry)}&nbsp;&middot;&nbsp;{entryTime(entry)}{/if}
						</span>
					</span>
				{/snippet}
				{#snippet body()}
					{#if entry.kind === 'route'}
						<p class="feed-meta">
							{entry.sport ?? 'Route'} · ♥ {entry.saves} saves · {entry.rides} rides
						</p>
						<span class="feed-badge"><StateBadge label={fitLabel(entry.fit)} tone={fitTone(entry.fit)} /></span>
					{:else if entry.kind === 'event' && entry.start_at}
						<p class="feed-meta">
							{eventWhen(entry.start_at)} · {entry.going_count} going
						</p>
						<span class="feed-rsvp">
							{#if rsvpDone[entry.id] && href}
								<a class="feed-rsvp-link" href={resolve(href)}>Going ✓</a>
							{:else}
								<SecondaryButton
									label={rsvpBusy === entry.id ? '…' : 'Going'}
									ariaLabel="RSVP going to {entry.title}"
									title="RSVP going to {entry.title}"
									disabled={rsvpBusy === entry.id}
									onclick={() => void rsvpGoing(entry)}
								/>
							{/if}
						</span>
						{#if rsvpErrors[entry.id]}
							<span class="feed-note">{rsvpErrors[entry.id]}</span>
						{/if}
					{:else}
						<p class="feed-meta">Activity update</p>
					{/if}
				{/snippet}
			</FeedItem>
		{/each}
	{/if}
</div>

<style>
	.home-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.home-checking {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.feed-avatar {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.feed-avatar-fallback {
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

	.feed-head-text {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.feed-title {
		font: var(--type-body-strong);
		color: var(--text-primary);
		text-decoration: none;
	}

	a.feed-title {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
	}

	a.feed-title:hover {
		text-decoration: underline;
	}

	a.feed-title:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.feed-sub {
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.feed-meta {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.feed-badge {
		display: inline-block;
		margin-top: 0.375rem;
	}

	.feed-rsvp {
		display: inline-block;
		margin-top: 0.5rem;
	}

	.feed-rsvp-link {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		padding: 0.625rem 1.25rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--text-primary);
		font: var(--type-body-strong);
		letter-spacing: 0.02em;
		text-decoration: none;
	}

	.feed-rsvp-link:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.feed-note {
		font: var(--type-meta);
		color: var(--text-secondary);
		align-self: center;
	}
</style>
