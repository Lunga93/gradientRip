<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import SegmentedControl from '$lib/ui/SegmentedControl.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import EmptyState from '$lib/ui/EmptyState.svelte';
	import Skeleton from '$lib/ui/Skeleton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import StateBadge from '$lib/ui/StateBadge.svelte';
	import FeedItem from '$lib/ui/FeedItem.svelte';
	import PostCard from '$lib/components/PostCard.svelte';
	import { channels, type Channel, type RosterMember } from '$lib/channels.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import { buildFeedCard, type FeedPostEntry, type PostCardPost } from '$lib/posts.svelte.js';
	import { compressPhoto, putObjectBytes } from '$lib/media.js';
	import { relTime } from '$lib/ui/format.js';

	interface CrewDetail extends Channel {
		avatar_url: string | null;
	}

	interface CrewEvent {
		id: string;
		channel_id: string;
		title: string;
		start_at: string;
		going_count: number;
		is_member: boolean;
	}

	interface CrewRoute {
		id: string;
		title: string;
		sport: string;
		saves: number;
		rides: number;
	}

	// Crew Posts tab pages the dedicated crew feed (limit 20, Show-more
	// while a full page returns). The cursor is the (created_at, id) tuple of
	// the last card — the id tie-break keeps equal-timestamp rows straddling
	// a page boundary (see the feed endpoint header).

	type Tab = 'posts' | 'events' | 'routes' | 'members';

	const TABS: { label: string; value: Tab }[] = [
		{ label: 'Posts', value: 'posts' },
		{ label: 'Events', value: 'events' },
		{ label: 'Routes', value: 'routes' },
		{ label: 'Members', value: 'members' }
	];

	const id = $derived(page.params.id ?? '');
	const inviteParam = $derived(page.url.searchParams.get('invite') ?? '');
	const myId = $derived(social.me?.id ?? null);

	let tab = $state<Tab>('posts');

	let detail = $state<CrewDetail | null>(null);
	let detailLoading = $state(true);
	let detailError = $state('');
	let privateLocked = $state(false);

	let joining = $state(false);
	let joinMsg = $state('');
	let inviteInput = $state('');
	let autoJoinNote = $state('');

	let members = $state<RosterMember[]>([]);
	let rosterLoading = $state(false);
	let rosterError = $state('');
	let memberBusy = $state<string | null>(null);
	let memberMsg = $state('');
	// Successful-leave confirmation that survives the flip to the
	// private-locked card (leaving a private crew 403s the detail reload,
	// so the Members-tab memberMsg unmounts with the tab).
	let leaveNote = $state('');

	let events = $state<CrewEvent[]>([]);
	let eventsLoading = $state(false);
	let eventsError = $state('');

	let routes = $state<CrewRoute[]>([]);
	let routesLoading = $state(false);
	let routesError = $state('');

	let cards = $state<PostCardPost[]>([]);
	let postsLoading = $state(false);
	let postsError = $state('');
	let postsHasMore = $state(false);
	let postsLoadingMore = $state(false);

	const POSTS_PAGE = 20;

	// Admin section state (lives in the Members tab).
	let editName = $state('');
	let editAbout = $state('');
	let saving = $state(false);
	let editMsg = $state('');
	let avatarFile = $state<File | null>(null);
	let avatarPreview = $state<string | null>(null);
	let avatarBusy = $state(false);
	let avatarMsg = $state('');
	let avatarInput = $state<HTMLInputElement | null>(null);
	let inviteLink = $state('');
	let inviteBusy = $state(false);
	let inviteMsg = $state('');
	let copiedNote = $state('');
	let deleting = $state(false);
	let deleteMsg = $state('');

	const crewInitial = $derived(((detail?.name || 'C')[0] || 'C').toUpperCase());
	const memberCount = $derived(detail?.member_count ?? 0);
	// Markup-safe aliases: `detail` narrowing is lost inside {#each}/{#if}
	// nesting (mutable $state), so templates read these deriveds instead.
	const isMember = $derived(detail?.is_member ?? false);
	const isAdmin = $derived(detail?.is_admin ?? false);
	const crewName = $derived(detail?.name ?? 'Crew');
	const crewMeta = $derived.by(() => {
		if (!detail) return '';
		const parts = [
			detail.visibility === 'open' ? 'Open' : 'Private',
			`${memberCount} member${memberCount === 1 ? '' : 's'}`
		];
		if (detail.sport) parts.push(detail.sport);
		if (detail.home_area) parts.push(detail.home_area);
		return parts.join(' · ');
	});

	const readMessage = async (res: Response, fallback: string): Promise<string> => {
		try {
			const data = (await res.json()) as { message?: unknown };
			if (typeof data.message === 'string' && data.message.trim()) return data.message;
		} catch {
			/* non-JSON error body — fall through */
		}
		return `${fallback} (HTTP ${res.status})`;
	};

	const avatarInitial = (name: string | null | undefined): string =>
		((((name || 'R').trim()[0] || 'R') as string) || 'R').toUpperCase();

	const joinedDate = (iso: string): string => {
		const t = new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
		return t || '';
	};

	const entryTime = (iso: string): string => {
		const ts = new Date(iso).getTime();
		return Number.isFinite(ts) ? relTime(ts) : '';
	};

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

	// --- Loaders (plain fetches, mirroring the event detail page) ---

	const loadDetail = async (): Promise<boolean> => {
		detailLoading = true;
		detailError = '';
		privateLocked = false;
		try {
			const res = await fetch(`/api/channels/${encodeURIComponent(id)}`);
			if (res.status === 404) {
				detailError = 'Crew not found.';
				return false;
			}
			if (res.status === 403) {
				privateLocked = true;
				return false;
			}
			if (!res.ok) {
				detailError = await readMessage(res, 'Could not load the crew');
				return false;
			}
			const data = (await res.json()) as { channel: CrewDetail };
			detail = data.channel;
			editName = detail.name;
			editAbout = detail.about ?? '';
			return true;
		} catch {
			detailError = 'Could not load the crew — check your connection.';
			return false;
		} finally {
			detailLoading = false;
		}
	};

	const loadRoster = async (): Promise<void> => {
		rosterLoading = true;
		rosterError = '';
		const res = await channels.roster(id);
		rosterLoading = false;
		if (res.ok) members = res.members;
		else rosterError = res.message;
	};

	const loadEvents = async (): Promise<void> => {
		eventsLoading = true;
		eventsError = '';
		try {
			const res = await fetch('/api/events');
			if (!res.ok) {
				eventsError = 'Could not load events.';
				return;
			}
			const data = (await res.json()) as { events: CrewEvent[] };
			events = (Array.isArray(data.events) ? data.events : []).filter((e) => e.channel_id === id);
		} catch {
			eventsError = 'Could not load events — check your connection.';
		} finally {
			eventsLoading = false;
		}
	};

	const loadPosts = async (): Promise<void> => {
		postsLoading = true;
		postsError = '';
		postsHasMore = false;
		try {
			const res = await fetch(
				`/api/channels/${encodeURIComponent(id)}/feed?limit=${POSTS_PAGE}`
			);
			if (!res.ok) {
				postsError = 'Could not load crew posts.';
				return;
			}
			const data = (await res.json()) as { items: FeedPostEntry[] };
			const rows = Array.isArray(data.items) ? data.items : [];
			cards = rows.map((r) => buildFeedCard(r));
			postsHasMore = rows.length >= POSTS_PAGE;
		} catch {
			postsError = 'Could not load crew posts — check your connection.';
		} finally {
			postsLoading = false;
		}
	};

	const loadMorePosts = async (): Promise<void> => {
		if (postsLoadingMore || !postsHasMore || cards.length === 0) return;
		postsLoadingMore = true;
		try {
			const before = cards[cards.length - 1]?.created_at ?? '';
			const beforeId = cards[cards.length - 1]?.id ?? '';
			const params = new URLSearchParams({ limit: String(POSTS_PAGE), before, beforeId });
			const res = await fetch(`/api/channels/${encodeURIComponent(id)}/feed?${params}`);
			if (!res.ok) {
				postsError = 'Could not load more crew posts.';
				return;
			}
			const data = (await res.json()) as { items: FeedPostEntry[] };
			const rows = Array.isArray(data.items) ? data.items : [];
			cards = [...cards, ...rows.map((r) => buildFeedCard(r))];
			postsHasMore = rows.length >= POSTS_PAGE;
		} catch {
			postsError = 'Could not load more crew posts — check your connection.';
		} finally {
			postsLoadingMore = false;
		}
	};

	const loadRoutes = async (): Promise<void> => {
		routesLoading = true;
		routesError = '';
		try {
			const res = await fetch('/api/events');
			if (!res.ok) {
				routesError = 'Could not load routes.';
				return;
			}
			const data = (await res.json()) as { events: { channel_id: string; route_id: string | null }[] };
			const routeIds = [
				...new Set(
					(Array.isArray(data.events) ? data.events : [])
						.filter((e) => e.channel_id === id && e.route_id)
						.map((e) => e.route_id as string)
				)
			];
			const found: CrewRoute[] = [];
			await Promise.all(
				routeIds.map(async (routeId) => {
					try {
						const r = await fetch(`/api/routes/${encodeURIComponent(routeId)}`);
						if (!r.ok) return;
						const route = (await r.json()) as CrewRoute;
						found.push(route);
					} catch {
						/* one missing route must not sink the tab */
					}
				})
			);
			routes = found;
		} catch {
			routesError = 'Could not load routes — check your connection.';
		} finally {
			routesLoading = false;
		}
	};

	const refreshAfterMembership = async (): Promise<void> => {
		const ok = await loadDetail();
		if (ok) await Promise.all([loadRoster(), loadEvents(), loadPosts(), loadRoutes()]);
	};

	// --- Join states ---

	const joinOpen = async (): Promise<void> => {
		if (joining || !detail || detail.is_member) return;
		joining = true;
		joinMsg = '';
		const res = await channels.join(detail.id);
		joining = false;
		if (!res.ok) {
			joinMsg = res.message;
			channels.lastError = '';
			return;
		}
		await refreshAfterMembership();
	};

	const joinWithToken = async (token: string): Promise<void> => {
		if (joining || !detail || detail.is_member || !token.trim()) return;
		joining = true;
		joinMsg = '';
		const res = await channels.joinWithInvite(detail.id, token.trim());
		joining = false;
		if (!res.ok) {
			joinMsg = res.message;
			channels.lastError = '';
			return;
		}
		await refreshAfterMembership();
	};

	// --- Roster admin controls + leave ---

	const memberAction = async (
		userId: string,
		kind: 'promote' | 'demote' | 'remove' | 'leave'
	): Promise<void> => {
		if (memberBusy) return;
		memberBusy = userId + kind;
		memberMsg = '';
		let res: { ok: boolean; message: string };
		if (kind === 'promote') res = await channels.promote(id, userId);
		else if (kind === 'demote') res = await channels.demote(id, userId);
		else if (kind === 'leave') res = await channels.leave(id, userId);
		else res = await channels.removeMember(id, userId);
		memberBusy = null;
		if (!res.ok) {
			memberMsg = res.message;
			channels.lastError = '';
			return;
		}
		memberMsg = res.message;
		if (kind === 'leave') leaveNote = res.message;
		await refreshAfterMembership();
	};

	// --- Admin section ---

	const saveEdit = async (): Promise<void> => {
		if (saving || !detail) return;
		saving = true;
		editMsg = '';
		const res = await channels.update(detail.id, { name: editName.trim(), about: editAbout.trim() });
		saving = false;
		if (!res.ok) {
			editMsg = res.message;
			channels.lastError = '';
			return;
		}
		editMsg = res.message;
		await loadDetail();
	};

	const onAvatarFile = (files: FileList | null): void => {
		avatarMsg = '';
		if (!files) return;
		const file = files[0];
		if (avatarInput) avatarInput.value = '';
		if (!file || !file.type.startsWith('image/')) {
			avatarMsg = 'That file is not a photo — pick an image file.';
			return;
		}
		if (avatarPreview) URL.revokeObjectURL(avatarPreview);
		avatarFile = file;
		avatarPreview = URL.createObjectURL(file);
	};

	const uploadAvatar = async (): Promise<void> => {
		if (avatarBusy || !avatarFile || !detail) return;
		avatarBusy = true;
		avatarMsg = '';
		try {
			const blob = await compressPhoto(avatarFile);
			const bytes = new Uint8Array(await blob.arrayBuffer());
			const mintRes = await fetch('/api/media/upload-urls', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					files: [{ kind: 'photo', contentType: 'image/jpeg', bytes: bytes.length }]
				})
			});
			if (!mintRes.ok) throw new Error(await readMessage(mintRes, 'Could not prepare the upload'));
			const minted = (await mintRes.json()) as { urls: { key: string; url: string }[] };
			if (!minted.urls[0]) throw new Error('Upload preparation mismatch — please try again');
			await putObjectBytes(minted.urls[0].url, bytes);
			const res = await channels.update(detail.id, { avatar_key: minted.urls[0].key });
			if (!res.ok) throw new Error(res.message);
			if (avatarPreview) URL.revokeObjectURL(avatarPreview);
			avatarPreview = null;
			avatarFile = null;
			avatarMsg = 'Avatar updated';
			await loadDetail();
		} catch (e) {
			avatarMsg = e instanceof Error ? e.message : 'Could not update the avatar — try again.';
			channels.lastError = '';
		} finally {
			avatarBusy = false;
		}
	};

	const mintInvite = async (): Promise<void> => {
		if (inviteBusy || !detail) return;
		inviteBusy = true;
		inviteMsg = '';
		copiedNote = '';
		const res = await channels.mintInvite(detail.id);
		inviteBusy = false;
		if (!res.ok || !res.invite_token) {
			inviteMsg = res.message;
			channels.lastError = '';
			return;
		}
		inviteLink = `${location.origin}${resolve(`/crew/${detail.id}` as `/crew/${string}`)}?invite=${res.invite_token}`;
		inviteMsg = res.message;
	};

	const copyInvite = async (): Promise<void> => {
		copiedNote = '';
		if (!inviteLink) return;
		try {
			if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
				await navigator.clipboard.writeText(inviteLink);
				copiedNote = 'Link copied';
			} else {
				copiedNote = 'Copying is not available here — long-press the link';
			}
		} catch {
			copiedNote = 'Could not copy — long-press the link instead';
		}
	};

	const revokeInvite = async (): Promise<void> => {
		if (inviteBusy || !detail) return;
		inviteBusy = true;
		inviteMsg = '';
		copiedNote = '';
		const res = await channels.revokeInvite(detail.id);
		inviteBusy = false;
		if (!res.ok) {
			inviteMsg = res.message;
			channels.lastError = '';
			return;
		}
		inviteLink = '';
		inviteMsg = res.message;
	};

	const deleteCrew = async (): Promise<void> => {
		if (deleting || !detail) return;
		const confirmed =
			typeof confirm === 'function'
				? confirm(`Delete ${detail.name}? Posts, events and the roster go with it. This cannot be undone.`)
				: true;
		if (!confirmed) return;
		deleting = true;
		deleteMsg = '';
		const res = await channels.remove(detail.id);
		deleting = false;
		if (!res.ok) {
			deleteMsg = res.message;
			channels.lastError = '';
			return;
		}
		await goto(resolve('/explore/crews'));
	};

	const openEvent = (eventId: string): void => {
		void goto(resolve(`/event/${eventId}` as `/event/${string}`));
	};

	const openRoute = (routeId: string): void => {
		void goto(resolve(`/route/${routeId}` as `/route/${string}`));
	};

	const postToCrew = (): void => {
		void goto(resolve(`/compose?crew=${encodeURIComponent(id)}` as '/compose'));
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (!social.signedIn) return;
			void (async () => {
				// Cold-open invite: join first (idempotent — members skip it),
				// then load the crew like a member would see it.
				if (inviteParam) {
					const res = await channels.joinWithInvite(id, inviteParam);
					autoJoinNote = res.ok ? 'Invite accepted — welcome to the crew.' : res.message;
				}
				const ok = await loadDetail();
				if (ok) await Promise.all([loadRoster(), loadEvents(), loadPosts(), loadRoutes()]);
			})();
		});
	});
</script>

<ScreenHeader title={detail?.name ?? 'Crew'} backHref="/explore/crews" />
<div class="crew-body">
	{#if social.me === undefined}
		<p class="crew-checking">Checking sign-in…</p>
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
	{:else if detailLoading}
		<Skeleton lines={4} />
	{:else if detailError}
		<ErrorNotice message={detailError} onRetry={() => void refreshAfterMembership()} />
	{:else if privateLocked}
		<div
			class="section-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<h2 class="section-title">This crew is private</h2>
			<p class="section-copy">Ask a member for an invite link, or paste one below.</p>
			{#if leaveNote}
				<p class="status-line" role="status">{leaveNote}</p>
			{/if}
			{#if autoJoinNote}
				<p class="status-line" role="status">{autoJoinNote}</p>
			{/if}
			<form
				class="join-row"
				onsubmit={(e) => {
					e.preventDefault();
					if (!detail) {
						// No detail row for outsiders: join straight at the id.
						if (joining || !inviteInput.trim()) return;
						joining = true;
						joinMsg = '';
						void channels
							.joinWithInvite(id, inviteInput.trim())
							.then((res) => {
								joining = false;
								if (!res.ok) {
									joinMsg = res.message;
									channels.lastError = '';
								} else void refreshAfterMembership();
							});
					} else void joinWithToken(inviteInput);
				}}
			>
				<input
					type="text"
					placeholder="Paste invite link or token…"
					bind:value={inviteInput}
					aria-label="Invite link or token"
					class="field min-w-0 flex-1"
				/>
				<PrimaryButton label={joining ? '…' : 'Join'} type="submit" disabled={joining || !inviteInput.trim()} />
			</form>
			{#if joinMsg}
				<ErrorNotice message={joinMsg} />
			{/if}
		</div>
	{:else if detail}
		{#if autoJoinNote}
			<p class="status-line" style="color: var(--state-live);" role="status">{autoJoinNote}</p>
		{/if}
		<div
			class="header-card"
			style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
		>
			<div class="header-top">
				{#if detail.avatar_url}
					<img
						src={detail.avatar_url}
						alt=""
						width="56"
						height="56"
						class="crew-avatar"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<span class="crew-avatar-fallback font-display" aria-hidden="true">{crewInitial}</span>
				{/if}
				<span class="header-text">
					<span class="header-title-row">
						<h2 class="crew-name">{detail.name}</h2>
						<StateBadge label={detail.visibility === 'open' ? 'OPEN' : 'PRIVATE'} tone="neutral" />
					</span>
					<p class="crew-meta">{crewMeta}</p>
				</span>
			</div>
			{#if detail.about}
				<p class="crew-about">{detail.about}</p>
			{/if}
			{#if !detail.is_member}
				<div class="join-row">
					{#if detail.visibility === 'open'}
						<PrimaryButton
							label={joining ? '…' : `Join ${detail.name}`}
							ariaLabel="Join {detail.name}"
							title="Join {detail.name}"
							disabled={joining}
							onclick={() => void joinOpen()}
						/>
					{:else}
						<form
							class="join-row"
							onsubmit={(e) => {
								e.preventDefault();
								void joinWithToken(inviteInput);
							}}
						>
							<input
								type="text"
								placeholder="Paste invite link or token…"
								bind:value={inviteInput}
								aria-label="Invite link or token"
								class="field min-w-0 flex-1"
							/>
							<PrimaryButton
								label={joining ? '…' : 'Join'}
								type="submit"
								disabled={joining || !inviteInput.trim()}
							/>
						</form>
					{/if}
				</div>
				{#if joinMsg}
					<ErrorNotice message={joinMsg} />
				{/if}
			{:else}
				<p class="status-line" style="color: var(--state-live);">You are a member.</p>
			{/if}
			{#if channels.lastError}
				<ErrorNotice message={channels.lastError} />
			{/if}
		</div>

		<SegmentedControl segments={TABS} current={tab} onSelect={(v) => (tab = v as Tab)} />

		{#if tab === 'posts'}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Crew posts · {cards.length}</span>
				{#if detail.is_member && cards.length > 0}
					<div class="tab-primary">
						<PrimaryButton
							label="Post to crew"
							ariaLabel="Post to {detail.name}"
							title="Post to {detail.name}"
							onclick={postToCrew}
						/>
					</div>
				{/if}
				{#if postsLoading && cards.length === 0}
					<Skeleton lines={3} />
				{:else if postsError}
					<ErrorNotice message={postsError} onRetry={() => void loadPosts()} />
				{:else if cards.length === 0}
					{#if detail.is_member}
						<EmptyState
							title="No posts yet"
							body="Start the crew's story — your post lands here."
							actionLabel="Write the first post"
							onAction={postToCrew}
						/>
					{:else}
						<EmptyState
							title="Member posts live here"
							body="Join this crew to see what the members are posting."
						/>
					{/if}
				{:else}
					<div class="post-stack">
						{#each cards as card (card.id)}
							<FeedItem>
								{#snippet header()}
									{#if card.author_avatar}
										<img
											src={card.author_avatar}
											alt=""
											width="32"
											height="32"
											class="feed-avatar"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<span class="feed-avatar-fallback" aria-hidden="true">
											{avatarInitial(card.author_name)}
										</span>
									{/if}
									<span class="feed-head-text">
										<span class="feed-title">{card.author_name?.trim() || 'Rider'}</span>
										<span class="feed-sub">{entryTime(card.created_at)}</span>
									</span>
								{/snippet}
								{#snippet body()}
									<PostCard post={card} isAuthor={!!myId && card.author?.id === myId} />
								{/snippet}
							</FeedItem>
						{/each}
					</div>
					{#if postsHasMore}
						<span class="show-more-row">
							<SecondaryButton
								label={postsLoadingMore ? '…' : 'Show more'}
								ariaLabel="Show more crew posts"
								title="Show more crew posts"
								disabled={postsLoadingMore}
								onclick={() => void loadMorePosts()}
							/>
						</span>
					{/if}
				{/if}
			</div>
		{:else if tab === 'events'}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Crew events · {events.length}</span>
				{#if eventsLoading && events.length === 0}
					<Skeleton lines={3} />
				{:else if eventsError}
					<ErrorNotice message={eventsError} onRetry={() => void loadEvents()} />
				{:else if events.length === 0}
					<EmptyState
						title="No events yet"
						body="Plan one from Explore — pick this crew as the channel and it lands here."
					/>
				{:else}
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
				{/if}
			</div>
		{:else if tab === 'routes'}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Crew routes · {routes.length}</span>
				{#if routesLoading && routes.length === 0}
					<Skeleton lines={3} />
				{:else if routesError}
					<ErrorNotice message={routesError} onRetry={() => void loadRoutes()} />
				{:else if routes.length === 0}
					<EmptyState
						title="No routes yet"
						body="Routes attached to this crew's events will show up here."
					/>
				{:else}
					<div class="stack">
						{#each routes as r (r.id)}
							<ListRow title={r.title} meta={`${r.sport} · ♥ ${r.saves} saves · ${r.rides} rides`}>
								{#snippet trailing()}
									<span class="row-actions">
										<SecondaryButton
											label="Open"
											ariaLabel="Open {r.title}"
											title="Open {r.title}"
											onclick={() => openRoute(r.id)}
										/>
									</span>
								{/snippet}
							</ListRow>
						{/each}
					</div>
				{/if}
			</div>
		{:else}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label">Members · {members.length}</span>
				{#if rosterLoading && members.length === 0}
					<Skeleton lines={3} />
				{:else if rosterError}
					<ErrorNotice message={rosterError} onRetry={() => void loadRoster()} />
				{:else}
					<div class="stack">
						{#each members as m (m.user_id)}
							<ListRow
								title={m.display_name}
								meta={`${m.role === 'admin' ? 'Admin' : 'Member'}${joinedDate(m.joined_at) ? ` · joined ${joinedDate(m.joined_at)}` : ''}`}
							>
								{#snippet avatar()}
									{#if m.avatar_url}
										<img
											src={m.avatar_url}
											alt=""
											width="32"
											height="32"
											class="feed-avatar"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<span class="feed-avatar-fallback" aria-hidden="true">
											{avatarInitial(m.display_name)}
										</span>
									{/if}
								{/snippet}
								{#snippet trailing()}
									<span class="row-actions">
										{#if m.user_id === myId}
											<StateBadge label="YOU" tone="accent" />
										{:else if m.role === 'admin'}
											<StateBadge label="ADMIN" tone="go" />
										{/if}
										{#if isAdmin && m.user_id !== myId}
											{#if m.role === 'admin'}
												<SecondaryButton
													label={memberBusy === m.user_id + 'demote' ? '…' : 'Demote'}
													ariaLabel="Demote {m.display_name} to member"
													title="Demote {m.display_name} to member"
													disabled={memberBusy !== null}
													onclick={() => void memberAction(m.user_id, 'demote')}
												/>
											{:else}
												<SecondaryButton
													label={memberBusy === m.user_id + 'promote' ? '…' : 'Promote'}
													ariaLabel="Promote {m.display_name} to admin"
													title="Promote {m.display_name} to admin"
													disabled={memberBusy !== null}
													onclick={() => void memberAction(m.user_id, 'promote')}
												/>
											{/if}
											<SecondaryButton
												label={memberBusy === m.user_id + 'remove' ? '…' : 'Remove'}
												ariaLabel="Remove {m.display_name} from the crew"
												title="Remove {m.display_name} from the crew"
												disabled={memberBusy !== null}
												onclick={() => void memberAction(m.user_id, 'remove')}
											/>
										{/if}
										{#if m.user_id === myId && isMember}
											<SecondaryButton
												label={memberBusy === m.user_id + 'leave' ? '…' : 'Leave'}
												ariaLabel="Leave {crewName}"
												title="Leave {crewName}"
												disabled={memberBusy !== null}
												onclick={() => void memberAction(m.user_id, 'leave')}
											/>
										{/if}
									</span>
								{/snippet}
							</ListRow>
						{/each}
					</div>
				{/if}
				{#if memberMsg}
					<p class="status-line" role="status">{memberMsg}</p>
				{/if}

				{#if detail.is_admin}
					<div class="admin-block">
						<span class="section-label">Crew settings</span>
						<form
							class="edit-form"
							onsubmit={(e) => {
								e.preventDefault();
								void saveEdit();
							}}
						>
							<label class="field-label" for="crew-name">Crew name</label>
							<input
								id="crew-name"
								type="text"
								required
								maxlength="60"
								bind:value={editName}
								aria-label="Crew name"
								class="field"
								disabled={saving}
							/>
							<label class="field-label" for="crew-about">About</label>
							<textarea
								id="crew-about"
								rows="3"
								maxlength="500"
								placeholder="What is this crew about?"
								bind:value={editAbout}
								aria-label="About this crew"
								class="field"
								disabled={saving}
							></textarea>
							<span class="field-counter" aria-live="polite">{editAbout.trim().length}/500</span>
							<span class="edit-row">
								<PrimaryButton
									label={saving ? '…' : 'Save changes'}
									type="submit"
									disabled={saving || !editName.trim()}
								/>
							</span>
						</form>
						{#if editMsg}
							<p class="status-line" role="status">{editMsg}</p>
						{/if}

						<span class="section-label">Crew avatar</span>
						<div class="avatar-row">
							{#if avatarPreview}
								<img src={avatarPreview} alt="New avatar preview" width="56" height="56" class="crew-avatar" />
							{:else if detail.avatar_url}
								<img
									src={detail.avatar_url}
									alt=""
									width="56"
									height="56"
									class="crew-avatar"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span class="crew-avatar-fallback font-display" aria-hidden="true">{crewInitial}</span>
							{/if}
							<span class="avatar-actions">
								<SecondaryButton
									label="Choose photo"
									ariaLabel="Choose a crew avatar photo"
									title="Choose a crew avatar photo"
									disabled={avatarBusy}
									onclick={() => avatarInput?.click()}
								/>
								{#if avatarFile}
									<SecondaryButton
										label={avatarBusy ? '…' : 'Upload avatar'}
										ariaLabel="Upload the crew avatar"
										title="Upload the crew avatar"
										disabled={avatarBusy}
										onclick={() => void uploadAvatar()}
									/>
								{/if}
							</span>
						</div>
						<input
							type="file"
							accept="image/*"
							hidden
							bind:this={avatarInput}
							onchange={(e) => onAvatarFile(e.currentTarget.files)}
							aria-hidden="true"
							tabindex="-1"
						/>
						{#if avatarMsg}
							<p class="status-line" role="status">{avatarMsg}</p>
						{/if}

						<span class="section-label">Invite link</span>
						{#if inviteLink}
							<p class="invite-link">{inviteLink}</p>
						{:else}
							<p class="section-copy">No active invite link — mint one to share.</p>
						{/if}
						<div class="invite-row">
							{#if inviteLink}
								<SecondaryButton
									label="Copy"
									ariaLabel="Copy the invite link"
									title="Copy the invite link"
									disabled={inviteBusy}
									onclick={() => void copyInvite()}
								/>
							{/if}
							<SecondaryButton
								label={inviteBusy ? '…' : inviteLink ? 'Rotate' : 'New link'}
								ariaLabel={inviteLink ? 'Rotate the invite link' : 'Create an invite link'}
								title={inviteLink ? 'Rotate the invite link' : 'Create an invite link'}
								disabled={inviteBusy}
								onclick={() => void mintInvite()}
							/>
							{#if inviteLink}
								<SecondaryButton
									label="Revoke"
									ariaLabel="Revoke the invite link"
									title="Revoke the invite link"
									disabled={inviteBusy}
									onclick={() => void revokeInvite()}
								/>
							{/if}
						</div>
						{#if copiedNote}
							<p class="status-line" role="status">{copiedNote}</p>
						{/if}
						{#if inviteMsg}
							<p class="status-line" role="status">{inviteMsg}</p>
						{/if}

						<span class="section-label">Danger zone</span>
						<div class="invite-row">
							<SecondaryButton
								label={deleting ? '…' : 'Delete crew'}
								ariaLabel="Delete {detail.name}"
								title="Delete {detail.name}"
								disabled={deleting}
								onclick={() => void deleteCrew()}
							/>
						</div>
						{#if deleteMsg}
							<ErrorNotice message={deleteMsg} />
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.crew-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.crew-checking {
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

	.header-card {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.875rem;
	}

	.header-top {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.crew-avatar {
		width: 56px;
		height: 56px;
		object-fit: cover;
		border-radius: var(--radius-md);
		flex-shrink: 0;
	}

	.crew-avatar-fallback {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		flex-shrink: 0;
		border-radius: var(--radius-md);
		background: var(--surface-sunken);
		border: 1px solid var(--line);
		color: var(--accent);
		font-size: 1.5rem;
		font-weight: 700;
	}

	.header-text {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 0;
		flex: 1 1 auto;
	}

	.header-title-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.crew-name {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.crew-meta {
		margin: 0;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.crew-about {
		margin: 0;
		font: var(--type-body);
		color: var(--text-primary);
		overflow-wrap: anywhere;
	}

	.join-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}

	.status-line {
		margin: 0.5rem 0 0;
		font: var(--type-body-strong);
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

	.section-title {
		margin: 0;
		font: var(--type-heading);
		color: var(--text-primary);
	}

	.section-copy {
		margin: 0;
		font: var(--type-body);
		color: var(--text-secondary);
	}

	.tab-primary {
		display: flex;
		margin: 0.25rem 0;
	}

	.show-more-row {
		display: flex;
		justify-content: center;
		margin-top: 0.25rem;
	}

	.stack {
		display: flex;
		flex-direction: column;
	}

	.post-stack {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.row-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
		justify-content: flex-end;
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
	}

	.feed-sub {
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.admin-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--line);
	}

	.edit-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.field-label {
		font: var(--type-label);
		letter-spacing: 0.02em;
		color: var(--text-secondary);
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

	.field-counter {
		align-self: flex-end;
		font: var(--type-meta);
		color: var(--text-secondary);
	}

	.edit-row {
		display: flex;
		margin-top: 0.25rem;
	}

	.avatar-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.avatar-actions {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.invite-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}

	.invite-link {
		margin: 0;
		font: var(--type-label);
		color: var(--text-secondary);
		word-break: break-all;
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
