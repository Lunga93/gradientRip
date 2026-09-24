<script lang="ts">
	import { onMount } from 'svelte';
	import { channels } from '$lib/channels.svelte.js';
	import { social } from '$lib/social.svelte.js';
	import ChannelDetail from '$lib/components/ChannelDetail.svelte';
	import SlashButton from '$lib/components/SlashButton.svelte';

	let name = $state('');
	let visibility = $state<'open' | 'private'>('open');
	let creating = $state(false);
	let createdMsg = $state('');
	let selectedId = $state<string | null>(null);

	const selected = $derived(
		selectedId ? (channels.channelFor(selectedId) ?? null) : null
	);

	const createChannel = async (): Promise<void> => {
		if (!name.trim() || creating) return;
		creating = true;
		createdMsg = '';
		const res = await channels.create(name.trim(), visibility);
		creating = false;
		if (res.ok) {
			name = '';
			createdMsg = res.message;
		}
	};

	onMount(() => {
		void social.probeMe().then(() => {
			if (social.signedIn) void channels.list();
		});
	});
</script>

<div class="view active p-5">
	<h2 class="font-display m-0 mb-1 text-[1.35rem] font-bold" style="color: var(--ink-0);">Channels</h2>
	<p class="m-0 mb-4 text-[0.8rem]" style="color: var(--ink-2);">
		Ride crews — open channels welcome everyone, private ones stay members-only.
	</p>

	{#if social.me === undefined}
		<p class="text-sm" style="color: var(--ink-2);">Checking sign-in…</p>
	{:else if !social.signedIn}
		<div class="chamfer-card flex flex-col items-center gap-3 p-6 text-center">
			<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">
				Sign in to join channels
			</h3>
			<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
				Google login unlocks channel membership — anonymous riding keeps working when signed out.
			</p>
			<a href="/api/auth/google" rel="external" class="slash-btn slash-btn-sm no-underline" style="text-decoration: none;">
				Continue with Google
			</a>
		</div>
	{:else if selected}
		<ChannelDetail channel={selected} onBack={() => (selectedId = null)} />
	{:else}
		<div class="chamfer-card mb-3 p-3.5">
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
				START A CHANNEL
			</span>
			<form
				class="flex flex-col gap-1.5"
				onsubmit={(e) => {
					e.preventDefault();
					void createChannel();
				}}
			>
				<input
					type="text"
					required
					maxlength="60"
					placeholder="e.g. Dawn Patrol"
					bind:value={name}
					aria-label="Channel name"
					class="min-w-0 flex-1 rounded-md px-3 py-2.5 text-sm"
					style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
				/>
				<div class="flex items-center gap-1.5">
					<select
						bind:value={visibility}
						aria-label="Channel visibility"
						class="rounded-md px-3 py-2.5 text-sm"
						style="background: var(--panel-soft); color: var(--ink-0); box-shadow: inset 0 0 0 1px var(--panel-line); border: none; min-height: 44px;"
					>
						<option value="open">Open — anyone can read & join</option>
						<option value="private">Private — members only</option>
					</select>
					<SlashButton label={creating ? '…' : 'Create'} size="sm" type="submit" />
				</div>
			</form>
			{#if channels.lastError}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">
					{channels.lastError}
				</p>
			{/if}
			{#if createdMsg}
				<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--v-go);" role="status">{createdMsg}</p>
			{/if}
		</div>

		{#if channels.loading && channels.count === 0}
			<p class="text-sm" style="color: var(--ink-2);">Loading channels…</p>
		{:else if channels.count === 0}
			<div class="flex flex-col items-center gap-2 px-6 py-10 text-center">
				<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">No channels yet</h3>
				<p class="m-0 text-sm leading-relaxed" style="color: var(--ink-2);">
					Start the first crew channel above — open channels are visible to every rider.
				</p>
			</div>
		{:else}
			<span class="font-mono2 mb-2 block" style="font-size: 0.62rem; letter-spacing: 0.16em; color: var(--ink-2);">
				CHANNELS · {channels.count}
			</span>
			<div class="flex flex-col gap-2.5">
				{#each channels.channels as ch (ch.id)}
					<div class="chamfer-card p-3.5">
						<div class="flex items-center gap-2.5">
							<button
								type="button"
								class="min-w-0 flex-1 cursor-pointer bg-transparent text-left"
								style="border: none;"
								onclick={() => (selectedId = ch.id)}
								title="Open {ch.name}"
							>
								<span class="block truncate text-[0.95rem] font-bold" style="color: var(--ink-0);">
									{ch.name}
								</span>
								<span class="block text-[0.7rem]" style="color: var(--ink-2);">
									{ch.visibility === 'open' ? 'Open' : 'Private'} · {ch.member_count} member{ch.member_count === 1 ? '' : 's'}
									{#if ch.sport} · {ch.sport}{/if}
								</span>
							</button>
							{#if !ch.is_member && ch.visibility === 'open'}
								<SlashButton label="Join" size="xs" onclick={() => channels.join(ch.id)} />
							{:else if ch.is_member}
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
