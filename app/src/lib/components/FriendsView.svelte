<script lang="ts">
	import { onMount } from 'svelte';
	import { social, friendName } from '$lib/social.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { loadTrip } from '$lib/planner.svelte.js';
	import { getOwnFix } from '$lib/tracker.js';
	import { renderFriendMarkers, clearFriendMarkers } from '$lib/mapController.svelte.js';
	import { haversine } from '$lib/util.js';
	import type { Trip } from '$lib/storage.js';
	import type { LivePeer } from '$lib/live.js';
	import SlashButton from '$lib/components/SlashButton.svelte';
	import Mark from '$lib/components/Mark.svelte';

	let email = $state('');
	let sending = $state(false);
	let sentMsg = $state('');
	let loginError = $state('');
	let expandedTrips = $state(false);

	const tripLabel = (t: Trip): string => t.queries.join(' → ') || 'Untitled route';

	const tripDay = (ts: number): string => {
		const d = new Date(ts);
		const now = new Date();
		const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const diff = Math.round((today - day) / 86400000);
		if (diff <= 0) return 'Today';
		if (diff === 1) return 'Yesterday';
		if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'short' });
		return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
	};

	const peerDistance = (p: LivePeer): string | null => {
		const own = getOwnFix();
		if (!own) return null;
		const km = haversine(own, [p.lat, p.lon]) / 1000;
		return km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`;
	};

	const liveFor = (id: string): LivePeer | undefined => social.livePeerFor(id);

	const speedText = (peer: LivePeer): string =>
		peer.speed != null && peer.speed > 0.5 ? ` at ${(peer.speed * 3.6).toFixed(0)} km/h` : '';

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

	const openFriendTrip = (t: Trip, name: string): void => {
		loadTrip(t);
		ui.setStatus(`Opened ${name}’s route — plan tab.`);
		ui.setTab('plan');
	};

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const login = params.get('login');
		if (login === 'ok') {
			ui.setStatus('Signed in — welcome back, rider.');
			history.replaceState(null, '', window.location.pathname);
		} else if (login === 'error') {
			const reason = params.get('reason');
			loginError =
				reason === 'denied'
					? 'Google sign-in was cancelled.'
					: reason === 'state'
						? 'Sign-in expired — please try again.'
						: 'Could not reach Google — check your connection and retry.';
			history.replaceState(null, '', window.location.pathname);
		}
		void social.probeMe();
	});

	$effect(() => {
		if (ui.activeTab === 'friends' && social.signedIn) {
			social.startLive();
			return () => social.stopLive();
		}
	});

	$effect(() => {
		const pins = social.livePeers.map((p) => ({
			id: p.id,
			name: friendName(p),
			avatar: p.avatar_url ?? '',
			lat: p.lat,
			lon: p.lon,
			stale: p.freshness !== 'live'
		}));
		if (pins.length > 0) renderFriendMarkers(pins);
		else clearFriendMarkers();
	});
</script>

<div class="view {ui.activeTab === 'friends' ? 'active' : ''} p-5">
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold">Friends</h2>
	<p class="m-0 mb-4 text-[0.8rem] text-base-content/70">
		Ride together — see buddies live on the map and open their shared routes.
	</p>

	{#if social.me === undefined}
		<p class="text-sm text-base-content/70">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div class="card border-base-300 bg-base-100 border shadow-sm">
			<div class="card-body items-center gap-3 p-6 text-center">
				<div class="avatar placeholder">
					<div class="bg-primary text-primary-content grid size-12 place-items-center rounded-box text-xl font-bold">
						<span>G</span>
					</div>
				</div>
				<h3 class="font-display m-0 text-base font-bold">
					Sign in to ride with friends
				</h3>
				<p class="m-0 text-sm leading-relaxed text-base-content/70">
					Google login links your saved trips to a real identity — nothing is lost, and
					anonymous riding keeps working when signed out.
				</p>
				{#if loginError}
					<p class="text-error m-0 text-sm font-bold" role="alert">{loginError}</p>
				{/if}
				<a
					href="/api/auth/google"
					rel="external"
					class="btn btn-primary btn-sm gap-2 no-underline"
				>
					Continue with Google
				</a>
			</div>
		</div>
	{:else if social.me}
		{@const me = social.me}
		<div class="card border-base-300 bg-base-100 mb-3 border shadow-sm">
			<div class="card-body flex-row items-center gap-3 p-3.5">
			{#if me.avatar_url}
				<div class="avatar shrink-0">
					<div class="ring-primary size-11 rounded-full ring ring-offset-2">
						<img src={me.avatar_url} alt="" width="44" height="44" referrerpolicy="no-referrer" />
					</div>
				</div>
			{:else}
				<div class="avatar placeholder shrink-0">
					<div class="bg-primary text-primary-content size-11 rounded-full">
						<span class="font-display text-lg font-bold">
							{(me.display_name || me.email || 'R')[0]?.toUpperCase()}
						</span>
					</div>
				</div>
			{/if}
			<span class="min-w-0 flex-1">
				<span class="font-display block truncate text-[1.05rem] leading-tight font-bold">
					{me.display_name || 'Rider'}
				</span>
				<span class="mt-0.5 block truncate text-[0.72rem] text-base-content/60">
					{me.email} · {social.friends.length} friend{social.friends.length === 1 ? '' : 's'}
					{#if social.liveConnected}· <span class="text-success">live feed on</span>{/if}
				</span>
			</span>
			<button
				type="button"
				class="btn btn-ghost btn-xs shrink-0"
				onclick={() => social.logout()}
			>
				Sign out
			</button>
			</div>
		</div>

		{#if social.liveNow.length > 0}
			<div class="card border-base-300 bg-base-100 mb-3 border shadow-sm">
				<div class="card-body gap-2 p-3.5">
				<span class="font-mono2 text-success mb-2 block text-[0.62rem] tracking-[0.16em]">
					● LIVE NOW · {social.liveNow.length}
				</span>
				<div class="flex flex-col gap-2">
					{#each social.liveNow as peer (peer.id)}
						{@const dist = peerDistance(peer)}
						<div class="flex items-center gap-2.5">
							{#if peer.avatar_url}
								<div class="avatar shrink-0">
									<div class="ring-success size-8 rounded-full ring ring-offset-2">
										<img src={peer.avatar_url} alt="" width="32" height="32" referrerpolicy="no-referrer" />
									</div>
								</div>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold">
									{friendName(peer)}
								</span>
								<span class="block text-[0.7rem] text-base-content/60">
									riding{speedText(peer)}{dist ? ` · ${dist}` : ''}
								</span>
							</span>
							<span class="badge badge-success badge-soft font-mono2 shrink-0 text-[0.62rem] font-bold">
								LIVE
							</span>
						</div>
					{/each}
				</div>
				</div>
			</div>
		{/if}

		<div class="card border-base-300 bg-base-100 mb-3 border shadow-sm">
			<div class="card-body gap-2 p-3.5">
			<span class="font-mono2 mb-2 block text-[0.62rem] tracking-[0.16em] text-base-content/60">
				ADD A RIDING BUDDY
			</span>
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
					class="input input-bordered min-w-0 flex-1 text-sm"
				/>
				<SlashButton label={sending ? '…' : 'Add'} size="sm" type="submit" />
			</form>
			{#if social.lastError}
				<p class="text-error m-0 mt-2 text-[0.78rem] font-bold" role="alert">
					{social.lastError}
				</p>
			{/if}
			{#if sentMsg}
				<p class="text-success m-0 mt-2 text-[0.78rem] font-bold" role="status">{sentMsg}</p>
			{/if}
			{#if social.outgoing.length > 0}
				<p class="m-0 mt-2 text-[0.75rem] text-base-content/60">
					Waiting on: {social.outgoing.map((o) => friendName(o)).join(', ')}
				</p>
			{/if}
			</div>
		</div>

		{#if social.incoming.length > 0}
			<div class="card border-base-300 bg-base-100 mb-3 border shadow-sm">
				<div class="card-body gap-2 p-3.5">
				<span class="font-mono2 text-warning mb-2 block text-[0.62rem] tracking-[0.16em]">
					REQUESTS · {social.incoming.length}
				</span>
				<div class="flex flex-col gap-2">
					{#each social.incoming as req (req.id)}
						<div class="flex items-center gap-2.5">
							{#if req.avatar_url}
								<div class="avatar shrink-0">
									<div class="size-8 rounded-full">
										<img src={req.avatar_url} alt="" width="32" height="32" referrerpolicy="no-referrer" />
									</div>
								</div>
							{/if}
							<span class="min-w-0 flex-1 truncate text-sm font-bold">
								{friendName(req)}
							</span>
							<button
								type="button"
								class="btn btn-success btn-soft btn-xs"
								onclick={() => social.respond(req.id, true)}
							>
								Accept
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs btn-circle"
								aria-label="Decline {friendName(req)}"
								onclick={() => social.respond(req.id, false)}
							>
								<Mark name="x" cls="size-3" />
							</button>
						</div>
					{/each}
				</div>
				</div>
			</div>
		{/if}

		{#if social.friends.length === 0}
			<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
				<h3 class="font-display m-0 text-base font-bold">No buddies yet</h3>
				<p class="m-0 text-sm leading-relaxed text-base-content/70">
					Add a friend by their Google email — once they accept, you'll see each other
					live on the map while riding.
				</p>
			</div>
		{:else}
			<span class="font-mono2 mb-2 block text-[0.62rem] tracking-[0.16em] text-base-content/60">
				BUDDIES · {social.friends.length}
			</span>
			<div class="flex flex-col gap-2.5">
				{#each social.friends as f (f.id)}
					{@const peer = liveFor(f.id)}
					{@const expanded = social.expandedFriend === f.id}
					<div class="card border-base-300 bg-base-100 border shadow-sm">
						<div class="card-body gap-2 p-3.5">
						<div class="flex items-center gap-2.5">
							{#if f.avatar_url}
								<div class="avatar shrink-0">
									<div class="size-9 rounded-full" class:ring={!!peer} class:ring-success={!!peer} class:ring-base-300={!peer} class:ring-offset-2={!!peer}>
										<img src={f.avatar_url} alt="" width="36" height="36" referrerpolicy="no-referrer" />
									</div>
								</div>
							{:else}
								<div class="avatar placeholder shrink-0">
									<div class="bg-base-300 text-base-content size-9 rounded-full">
										<span class="font-display text-sm font-bold" aria-hidden="true">
											{friendName(f)[0]?.toUpperCase()}
										</span>
									</div>
								</div>
							{/if}
							<button
								type="button"
								class="min-w-0 flex-1 cursor-pointer text-left"
								onclick={() => social.toggleExpand(f.id)}
								aria-expanded={expanded}
								title="Show {friendName(f)}'s shared routes"
							>
								<span class="block truncate text-[0.95rem] font-bold">
									{friendName(f)}
								</span>
								<span class="block text-[0.7rem]" class:text-success={!!peer} class:text-base-content={!peer} class:opacity-60={!peer}>
									{peer ? (peer.freshness === 'live' ? '● riding now' : '○ recently active') : 'offline'}
								</span>
							</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs shrink-0"
								aria-label="Remove {friendName(f)}"
								title="Remove friend"
								onclick={() => social.removeFriend(f.id)}
							>
								<Mark name="x" cls="size-3" />
							</button>
						</div>
						{#if expanded}
							{@const trips = social.friendTrips[f.id] ?? []}
							<div class="mt-2.5 flex flex-col gap-2">
								<div class="divider my-0"></div>
								<span class="font-mono2 text-[0.6rem] tracking-[0.14em] text-base-content/60">
									SHARED ROUTES · {trips.length}
								</span>
								{#if trips.length === 0}
									<p class="m-0 text-[0.78rem] text-base-content/60">
										{friendName(f)} hasn't shared any routes yet.
									</p>
								{:else}
									{#each trips as t (t.ts)}
										<div class="flex items-center gap-2">
											<span class="min-w-0 flex-1">
												<span class="block truncate text-[0.85rem] font-bold">
													{tripLabel(t)}
												</span>
												<span class="block text-[0.68rem] text-base-content/60">
													{t.totalKm.toFixed(1)} km · +{t.totalClimb.toFixed(0)} m · {tripDay(t.ts)}
												</span>
											</span>
											<SlashButton label="Open" size="xs" onclick={() => openFriendTrip(t, friendName(f))} />
										</div>
									{/each}
								{/if}
							</div>
						{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="mt-3">
			<button
				type="button"
				class="btn btn-ghost btn-sm w-full justify-start text-[0.78rem] font-normal"
				onclick={() => (expandedTrips = !expandedTrips)}
				aria-expanded={expandedTrips}
			>
				{expandedTrips ? '▾' : '▸'} How do my buddies see my routes?
			</button>
			{#if expandedTrips}
				<p class="m-0 mt-1 text-[0.78rem] leading-relaxed text-base-content/70">
					Open the Saved tab and flip <strong>Share</strong> on any trip — it becomes
					visible to your accepted buddies only. Flip it off any time to go private again.
				</p>
			{/if}
		</div>
	{/if}
</div>
