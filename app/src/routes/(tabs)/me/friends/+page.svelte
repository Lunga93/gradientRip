<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { social, friendName } from '$lib/social.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { domain } from '$lib/state/domain.svelte.js';
	import { loadTrip } from '$lib/planner.svelte.js';
	import { getOwnFix } from '$lib/tracker.js';
	import { haversine } from '$lib/util.js';
	import { fmtCount } from '$lib/ui/format.js';
	import type { Trip } from '$lib/storage.js';
	import type { LivePeer } from '$lib/live.js';

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

	const openFriendTrip = (t: Trip, name: string): void => {
		try {
			loadTrip(t);
		} catch (err) {
			const msg = err instanceof Error ? err.message : '';
			const fresh = !!domain.results && domain.results.line === (t.line as [number, number][]);
			if (!msg.includes('Map not initialised') || !fresh) throw err;
			// Cleaner long-term fix: a pending-route queue in mapController
			// flushed on createMap, instead of relying on applyResult ordering.
			/* no map mounted — landing below restores from domain.results */
		}
		ui.setStatus(`Opened ${name}’s route.`);
		void goto(resolve('/map'));
	};

	onMount(() => {
		void social.probeMe();
	});
</script>

<ScreenHeader title="Friends" backHref="/me" />
<div class="friends-body">
	{#if social.me === undefined}
		<p class="friends-checking">Checking sign-in…</p>
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
			<h2 class="signin-title">Sign in to ride with friends</h2>
			<p class="signin-copy">
				Google login links your saved trips to a real identity — nothing is lost, and
				anonymous riding keeps working when signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="ui-btn ui-btn-primary">Continue with Google</a>
		</div>
	{:else}
		<!-- live now -->
		{#if social.liveNow.length > 0}
			<div
				class="section-card"
				style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
			>
				<span class="section-label" style="color: var(--state-live);">
					● LIVE NOW · {social.liveNow.length}
				</span>
				<div class="live-list">
					{#each social.liveNow as peer (peer.id)}
						{@const dist = peerDistance(peer)}
						<ListRow
							title={friendName(peer)}
							meta="riding{speedText(peer)}{dist ? ` · ${dist}` : ''}"
						>
							{#snippet avatar()}
								{#if peer.avatar_url}
									<img
										src={peer.avatar_url}
										alt=""
										width="32"
										height="32"
										class="avatar-32"
										style="box-shadow: 0 0 0 2px var(--state-live);"
										referrerpolicy="no-referrer"
									/>
								{/if}
							{/snippet}
							{#snippet trailing()}
								<span
									class="font-mono2 live-pill"
									style="background: color-mix(in srgb, var(--state-live) 16%, transparent); color: var(--state-live);"
								>
									LIVE
								</span>
							{/snippet}
						</ListRow>
					{/each}
				</div>
			</div>
		{/if}

		<!-- pending requests live on /activity -->
		{#if social.incoming.length > 0}
			<ListRow
				href="/activity"
				title="{fmtCount(social.incoming.length)} friend {social.incoming.length === 1
					? 'request'
					: 'requests'} waiting"
				meta="Review on Activity"
			/>
		{/if}

		<!-- friends list -->
		{#if social.friends.length === 0}
			<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
				<h3 class="font-display m-0 text-base font-bold" style="color: var(--text-primary);">No buddies yet</h3>
				<p class="m-0 text-sm leading-relaxed" style="color: var(--text-secondary);">
					Add a friend by their Google email — once they accept, you'll see each other
					live on the map while riding.
				</p>
			</div>
		{:else}
			<span class="section-label">BUDDIES · {social.friends.length}</span>
			<div class="flex flex-col gap-2.5">
				{#each social.friends as f (f.id)}
					{@const peer = liveFor(f.id)}
					{@const expanded = social.expandedFriend === f.id}
					<div
						class="buddy-card"
						style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
					>
						<div class="flex items-center gap-2.5">
							{#if f.avatar_url}
								<img
									src={f.avatar_url}
									alt=""
									width="36"
									height="36"
									class="avatar-36"
									style="box-shadow: 0 0 0 2px {peer ? 'var(--state-live)' : 'var(--line)'};"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span
									class="font-display avatar-36-fallback"
									style="background: var(--surface-sunken); color: var(--text-primary); box-shadow: inset 0 0 0 1px var(--line);"
									aria-hidden="true"
								>
									{friendName(f)[0]?.toUpperCase()}
								</span>
							{/if}
						<button
								type="button"
								class="buddy-expand min-w-0 flex-1 cursor-pointer bg-transparent text-left"
								style="border: none; min-height: 44px;"
								onclick={() => social.toggleExpand(f.id)}
								aria-expanded={expanded}
								aria-label="Show {friendName(f)}'s shared routes"
								title="Show {friendName(f)}'s shared routes"
							>
								<span class="block truncate text-[0.95rem] font-bold" style="color: var(--text-primary);">
									{friendName(f)}
								</span>
								<span class="block" style="font: var(--type-label); color: {peer ? 'var(--state-live)' : 'var(--text-tertiary)'};">
									{peer ? (peer.freshness === 'live' ? '● riding now' : '○ recently active') : 'offline'}
								</span>
							</button>
							<button
								type="button"
								class="icon-btn shrink-0"
								style="border: 1px solid var(--line); color: var(--text-secondary);"
								aria-label="Remove {friendName(f)}"
								title="Remove friend"
								onclick={() => social.removeFriend(f.id)}
							>
								<Mark name="x" cls="size-3" />
							</button>
						</div>
						{#if expanded}
							{@const trips = social.friendTrips[f.id] ?? []}
							<div class="shared-trips" style="border-top: 1px solid var(--line);">
								<span class="section-label">SHARED ROUTES · {trips.length}</span>
								{#if trips.length === 0}
									<p class="m-0" style="font: var(--type-label); color: var(--text-secondary);">
										{friendName(f)} hasn't shared any routes yet.
									</p>
								{:else}
									<div class="stack">
										{#each trips as t (t.ts)}
											<ListRow
												title={tripLabel(t)}
												meta="{t.totalKm.toFixed(1)} km · +{t.totalClimb.toFixed(0)} m · {tripDay(t.ts)}"
											>
												{#snippet trailing()}
													<SecondaryButton
														label="Open"
														ariaLabel="Open {friendName(f)}'s route {tripLabel(t)}"
														title="Open {friendName(f)}'s route"
														onclick={() => openFriendTrip(t, friendName(f))}
													/>
												{/snippet}
											</ListRow>
										{/each}
									</div>
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
				class="hint-toggle w-full cursor-pointer bg-transparent text-left"
				style="border: none; font: var(--type-label); color: var(--text-secondary);"
				onclick={() => (expandedTrips = !expandedTrips)}
				aria-expanded={expandedTrips}
			>
				{expandedTrips ? '▾' : '▸'} How do my buddies see my routes?
			</button>
			{#if expandedTrips}
				<p class="m-0 mt-1 leading-relaxed" style="font: var(--type-label); color: var(--text-secondary);">
					Open My rides and flip <strong>Share</strong> on any trip — it becomes
					visible to your accepted buddies only. Flip it off any time to go private again.
				</p>
			{/if}
		</div>
	{/if}
</div>

<style>
	.friends-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.friends-checking {
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

	.live-list,
	.stack {
		display: flex;
		flex-direction: column;
	}

	.live-pill {
		border-radius: 9999px;
		padding: 0.25rem 0.5rem;
		font: var(--type-label);
		flex-shrink: 0;
	}

	.avatar-32 {
		width: 32px;
		height: 32px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.avatar-36 {
		width: 36px;
		height: 36px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.avatar-36-fallback {
		display: grid;
		place-items: center;
		width: 36px;
		height: 36px;
		flex-shrink: 0;
		font-size: 0.875rem;
		font-weight: 700;
		border-radius: 9999px;
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

	.buddy-card {
		padding: 0.875rem;
	}

	.shared-trips {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.625rem;
		padding-top: 0.625rem;
	}

	.hint-toggle {
		min-height: 44px;
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
