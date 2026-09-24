<script lang="ts">
	import type { Channel } from '$lib/channels.svelte.js';
	import { channels } from '$lib/channels.svelte.js';
	import SlashButton from '$lib/components/SlashButton.svelte';

	let { channel, onBack }: { channel: Channel; onBack: () => void } = $props();

	let joining = $state(false);

	const join = async (): Promise<void> => {
		if (joining || channel.is_member) return;
		joining = true;
		await channels.join(channel.id);
		joining = false;
	};
</script>

<div class="chamfer-card p-3.5">
	<button
		type="button"
		class="mb-2 cursor-pointer bg-transparent text-[0.78rem]"
		style="border: none; color: var(--ink-2);"
		onclick={onBack}
	>
		← All channels
	</button>
	<h3 class="font-display m-0 text-base font-bold" style="color: var(--ink-0);">{channel.name}</h3>
	<p class="m-0 mt-1 text-[0.75rem]" style="color: var(--ink-2);">
		{channel.visibility === 'open' ? 'Open channel' : 'Private channel'}
		· {channel.member_count} member{channel.member_count === 1 ? '' : 's'}
		{#if channel.sport} · {channel.sport}{/if}
		{#if channel.home_area} · {channel.home_area}{/if}
	</p>
	{#if !channel.is_member && channel.visibility === 'open'}
		<div class="mt-3">
			<SlashButton label={joining ? '…' : 'Join channel'} size="sm" onclick={join} />
		</div>
	{:else if channel.is_member}
		<p class="m-0 mt-3 text-[0.78rem] font-bold" style="color: var(--v-go);">You are a member.</p>
	{:else}
		<p class="m-0 mt-3 text-[0.78rem]" style="color: var(--ink-2);">
			Members-only — ask a member to add you.
		</p>
	{/if}
	{#if channels.lastError}
		<p class="m-0 mt-2 text-[0.78rem] font-bold" style="color: var(--color-error);" role="alert">
			{channels.lastError}
		</p>
	{/if}
</div>
