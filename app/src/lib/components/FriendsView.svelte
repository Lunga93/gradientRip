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

	// (Re)subscribe whenever the tab is opened while signed in.
	$effect(() => {
		if (ui.activeTab === 'friends' && social.signedIn) {
			social.startLive();
			return () => social.stopLive();
		}
	});

	// Mirror live buddies onto the map (cleared when nobody is live).
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
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold" style="color: var(--ink-0);">Friends</h2>
	<p class="m-0 mb-4 text-[0.8rem]" style="color: var(--ink-2);">
		Ride together — see buddies live on the map and open their shared routes.
	</p>

	{#if social.me === undefined}
		<p class="text-sm" style="color: var(--ink-2);">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div class="chamfer-card flex flex-col items-center gap-3 p-6 text-center">
			<span
				class="font-display grid size-12 place-items-center text-xl font-bold"
				style="background: color-mix(in srgb, var(--color-primary) 16%, transparent); color: var(--color-primary); border-radius: 10px;"
				aria-hidden="true"
			>
				G
			</span>
			<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">
				Sign in to ride with friends
			</h3>
			<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
				Google login links your saved trips to a real identity — nothing is lost, and
				anonymous riding keeps working when signed out.
			</p>
			{#if loginError}
				<p class="m-0 text-sm font-bold" style="color: var(--color-error);" role="alert">{loginError}</p>
			{/if}
			<a
				href="/api/auth/google"
				rel="external"
				class="slash-btn slash-btn-sm no-underline"
				style="display: inline-flex; align-items: center; gap: 0.5rem; text-decoration: none;"
			>
				Continue with Google
			</a>
		</div>
	{:else if social.me}
		{@const me = social.me}
		<!-- profile row -->
		<div class="chamfer-card mb-3 flex items-center gap-3 p-3.5">
			{#if me.avatar_url}
				<img
					src={me.avatar_url}
					alt=""
					width="44"
					height="44"
					class="shrink-0 rounded-full"
					style="width: 44px; height: 44px; object-fit: cover; box-shadow: 0 0 0 2px var(--color-primary);"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<span
					class="font-display grid shrink-0 place-items-center text-lg font-bold"
					style="width: 44px; height: 44px; border-radius: 9999px; background: var(--color-primary); color: #fff;"
					aria-hidden="true"
				>
					{(me.display_name || me.email || 'R')[0]?.toUpperCase()}
				</span>
			{/if}
			<span class="min-w-0 flex-1">
				<span class="font-display block truncate text-[1.05rem] leading-tight font-bold" style="color: var(--ink-0);">
					{me.display_name || 'Rider'}
				</span>
				<span class="mt-0.5 block truncate text-[0.72rem]" style="color: var(--ink-2);">
					{me.email} · {social.friends.length} friend{social.friends.length === 1 ? '' : 's'}
					{#if social.liveConnected}· <span style="color: var(--v-go);">live feed on</span>{/if}
				</span>
			</span>
			<button
				type="button"
				class="slash-btn slash-btn-xs shrink-0"
				style="background: transparent; box-shadow: inset 0 0 0 1px var(--panel-line); color: var(--ink-1); filter: none;"
				onclick={() => social.logout()}
			>
				Sign out
			</button>
		</div>

		<!-- live now -->
		{#if social.liveNow.length > 0}
			<div class="chamfer-card mb-3 p-3.5" style="--vt: var(--v-go);">
				<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--v-go);">
					● LIVE NOW · {social.liveNow.length}
				</span>
				<div class="flex flex-col gap-2">
					{#each social.liveNow as peer (peer.id)}
						{@const dist = peerDistance(peer)}
						<div class="flex items-center gap-2.5">
							{#if peer.avatar_url}
								<img
									src={peer.avatar_url}
									alt=""
									width="32"
									height="32"
									class="shrink-0 rounded-full"
									style="width: 32px; height: 32px; object-fit: cover; box-shadow: 0 0 0 2px var(--v-go);"
									referrerpolicy="no-referrer"
								/>
							{/if}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-sm font-bold" style="color: var(--ink-0);">
									{friendName(peer)}
								</span>
								<span class="block text-[0.7rem]" style="color: var(--ink-2);">
									riding{speedText(peer)}{dist ? ` · ${dist}` : ''}
								</span>
							</span>
							<span
								class="font-mono2 shrink-0 rounded-full px-2 py-1"
								style="font-size: 0.62rem; font-weight: 700; background: color-mix(in srgb, var(--v-go) 16%, transparent); color: var(--v-go);"
							>
								LIVE
							</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- add friend -->
		<div class="chamfer-card mb-3 p-3.5">
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
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
					class="min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm"
					style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
				/>
				<SlashButton label={sending ? '…' : 'Add'} size="sm" type="submit" />
			</form>
			{#if social.lastError}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">
					{social.lastError}
				</p>
			{/if}
			{#if sentMsg}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--v-go);" role="status">{sentMsg}</p>
			{/if}
			{#if social.outgoing.length > 0}
				<p class="m-0 mt-2 text-[0.75rem]" style="color: var(--ink-2);">
					Waiting on: {social.outgoing.map((o) => friendName(o)).join(', ')}
				</p>
			{/if}
		</div>

		<!-- incoming requests -->
		{#if social.incoming.length > 0}
			<div class="chamfer-card mb-3 p-3.5" style="--vt: var(--v-caution);">
				<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--v-caution);">
					REQUESTS · {social.incoming.length}
				</span>
				<div class="flex flex-col gap-2">
					{#each social.incoming as req (req.id)}
						<div class="flex items-center gap-2.5">
							{#if req.avatar_url}
								<img
									src={req.avatar_url}
									alt=""
									width="32"
									height="32"
									class="shrink-0 rounded-full"
									style="width: 32px; height: 32px; object-fit: cover;"
									referrerpolicy="no-referrer"
								/>
							{/if}
							<span class="min-w-0 flex-1 truncate text-sm font-bold" style="color: var(--ink-0);">
								{friendName(req)}
							</span>
							<button
								type="button"
								class="slash-btn slash-btn-xs"
								style="filter: none; background: color-mix(in srgb, var(--v-go) 16%, transparent); color: var(--v-go); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--v-go) 40%, transparent);"
								onclick={() => social.respond(req.id, true)}
							>
								Accept
							</button>
							<button
								type="button"
								class="slash-btn slash-btn-xs"
								style="filter: none; background: transparent; box-shadow: inset 0 0 0 1px var(--panel-line); color: var(--ink-1);"
								aria-label="Decline {friendName(req)}"
								onclick={() => social.respond(req.id, false)}
							>
								<Mark name="x" cls="size-3" />
							</button>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- friends list -->
		{#if social.friends.length === 0}
			<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
				<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">No buddies yet</h3>
				<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
					Add a friend by their Google email — once they accept, you'll see each other
					live on the map while riding.
				</p>
			</div>
		{:else}
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
				BUDDIES · {social.friends.length}
			</span>
			<div class="flex flex-col gap-2.5">
				{#each social.friends as f (f.id)}
					{@const peer = liveFor(f.id)}
					{@const expanded = social.expandedFriend === f.id}
					<div class="chamfer-card p-3.5">
						<div class="flex items-center gap-2.5">
							{#if f.avatar_url}
								<img
									src={f.avatar_url}
									alt=""
									width="36"
									height="36"
									class="shrink-0 rounded-full"
									style="width: 36px; height: 36px; object-fit: cover; box-shadow: 0 0 0 2px {peer ? 'var(--v-go)' : 'var(--panel-line)'};"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span
									class="font-display grid shrink-0 place-items-center text-sm font-bold"
									style="width: 36px; height: 36px; border-radius: 9999px; background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line);"
									aria-hidden="true"
								>
									{friendName(f)[0]?.toUpperCase()}
								</span>
							{/if}
							<button
								type="button"
								class="min-w-0 flex-1 cursor-pointer bg-transparent text-left"
								style="border: none;"
								onclick={() => social.toggleExpand(f.id)}
								aria-expanded={expanded}
								title="Show {friendName(f)}'s shared routes"
							>
								<span class="block truncate text-[0.95rem] font-bold" style="color: var(--ink-0);">
									{friendName(f)}
								</span>
								<span class="block text-[0.7rem]" style="color: {peer ? 'var(--v-go)' : 'var(--ink-2)'};">
									{peer ? (peer.freshness === 'live' ? '● riding now' : '○ recently active') : 'offline'}
								</span>
							</button>
							<button
								type="button"
								class="slash-btn slash-btn-xs shrink-0"
								style="filter: none; background: transparent; box-shadow: inset 0 0 0 1px var(--panel-line); color: var(--ink-1);"
								aria-label="Remove {friendName(f)}"
								title="Remove friend"
								onclick={() => social.removeFriend(f.id)}
							>
								<Mark name="x" cls="size-3" />
							</button>
						</div>
						{#if expanded}
							{@const trips = social.friendTrips[f.id] ?? []}
							<div class="mt-2.5 flex flex-col gap-2" style="border-top: 1px solid var(--panel-line); padding-top: 0.625rem;">
								<span class="font-mono2" style="font-size: 0.6rem; letter-spacing: 0.14em; color: var(--ink-2);">
									SHARED ROUTES · {trips.length}
								</span>
								{#if trips.length === 0}
									<p class="m-0 text-[0.78rem]" style="color: var(--ink-2);">
										{friendName(f)} hasn't shared any routes yet.
									</p>
								{:else}
									{#each trips as t (t.ts)}
										<div class="flex items-center gap-2">
											<span class="min-w-0 flex-1">
												<span class="block truncate text-[0.85rem] font-bold" style="color: var(--ink-0);">
													{tripLabel(t)}
												</span>
												<span class="block text-[0.68rem]" style="color: var(--ink-2);">
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
				{/each}
			</div>
		{/if}

		<!-- my shared routes hint -->
		<div class="mt-3">
			<button
				type="button"
				class="w-full cursor-pointer bg-transparent text-left text-[0.78rem]"
				style="border: none; color: var(--ink-2);"
				onclick={() => (expandedTrips = !expandedTrips)}
				aria-expanded={expandedTrips}
			>
				{expandedTrips ? '▾' : '▸'} How do my buddies see my routes?
			</button>
			{#if expandedTrips}
				<p class="m-0 mt-1 text-[0.78rem] leading-relaxed" style="color: var(--ink-2);">
					Open the Saved tab and flip <strong>Share</strong> on any trip — it becomes
					visible to your accepted buddies only. Flip it off any time to go private again.
				</p>
			{/if}
		</div>
	{/if}
</div>
