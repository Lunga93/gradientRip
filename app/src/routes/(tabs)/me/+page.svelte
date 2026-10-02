<script lang="ts">
	import { onMount } from 'svelte';
	import ScreenHeader from '$lib/ui/ScreenHeader.svelte';
	import ListRow from '$lib/ui/ListRow.svelte';
	import PrimaryButton from '$lib/ui/PrimaryButton.svelte';
	import SecondaryButton from '$lib/ui/SecondaryButton.svelte';
	import ErrorNotice from '$lib/ui/ErrorNotice.svelte';
	import Mark from '$lib/components/Mark.svelte';
	import { social } from '$lib/social.svelte.js';
	import { ui } from '$lib/state/ui.svelte.js';
	import { domain } from '$lib/state/domain.svelte.js';

	let loginError = $state('');

	const themeName = $derived(
		ui.theme === 'auto' ? 'Auto' : ui.theme === 'light' ? 'Light' : 'Dark'
	);

	const signInWithGoogle = (): void => {
		window.location.href = '/api/auth/google';
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
</script>

<ScreenHeader title="Me" />
<div class="me-body">
	{#if social.me === undefined}
		<p class="me-checking">Checking sign-in…</p>
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
			{#if loginError}
				<ErrorNotice message={loginError} />
			{/if}
			<PrimaryButton label="Continue with Google" onclick={signInWithGoogle} />
		</div>
	{:else if social.me}
		{@const me = social.me}
		<ListRow
			title={me.display_name || 'Rider'}
			meta="{me.email} · {social.friends.length} friend{social.friends.length === 1
				? ''
				: 's'}{social.liveConnected ? ' · live feed on' : ''}"
		>
			{#snippet avatar()}
				{#if me.avatar_url}
					<img
						src={me.avatar_url}
						alt=""
						width="44"
						height="44"
						class="me-avatar"
						style="box-shadow: 0 0 0 2px var(--accent);"
						referrerpolicy="no-referrer"
					/>
				{:else}
					<span
						class="font-display me-avatar-fallback"
						style="background: var(--accent); color: var(--text-on-accent);"
						aria-hidden="true"
					>
						{(me.display_name || me.email || 'R')[0]?.toUpperCase()}
					</span>
				{/if}
			{/snippet}
			{#snippet trailing()}
				<SecondaryButton label="Sign out" onclick={() => social.logout()} />
			{/snippet}
		</ListRow>
	{/if}

	<span class="section-label">RIDES & BUDDIES</span>
	<div class="me-links">
		<ListRow
			href="/me/rides"
			title="My rides"
			meta="{domain.trips.length} saved trip{domain.trips.length === 1 ? '' : 's'}"
		/>
		<ListRow
			href="/me/friends"
			title="Friends"
			meta={social.signedIn
				? `${social.friends.length} budd${social.friends.length === 1 ? 'y' : 'ies'}`
				: 'Sign in to ride together'}
		/>
	</div>

	<span class="section-label">SETTINGS</span>
	<div
		class="settings-card"
		style="background: var(--surface-raised); border: 1px solid var(--line); border-radius: var(--radius-md);"
	>
		<div class="settings-row">
			<span class="settings-name">Connection</span>
			<span
				class="net-badge"
				style="color: {ui.netOnline
					? 'var(--state-live)'
					: 'var(--state-caution)'}; background: color-mix(in srgb, currentcolor 12%, transparent);"
				title={ui.netOnline ? 'Connected' : 'Offline — saved trips still open.'}
			>
				<i aria-hidden="true"></i>
				{ui.netOnline ? 'ONLINE' : 'OFFLINE'}
			</span>
		</div>
		<div class="settings-row">
			<span class="settings-name">Theme · {themeName}</span>
			<button
				type="button"
				class="theme-toggle"
				style="background: var(--surface-sunken); box-shadow: inset 0 0 0 1px var(--line); color: var(--accent);"
				title={ui.theme === 'auto'
					? 'Theme follows your system — tap to override'
					: 'Theme pinned — tap to change'}
				aria-label="Cycle theme (auto, light, dark)"
				onclick={() => ui.cycleTheme()}
			>
				{#if ui.theme === 'dark'}
					<Mark name="sun" cls="size-4" />
				{:else if ui.theme === 'light'}
					<Mark name="moon" cls="size-4" />
				{:else}
					<Mark name="monitor" cls="size-4" />
				{/if}
			</button>
		</div>
	</div>
</div>

<style>
	.me-body {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--surface-page);
	}

	.me-checking {
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

	.me-avatar {
		width: 44px;
		height: 44px;
		object-fit: cover;
		border-radius: 9999px;
		flex-shrink: 0;
	}

	.me-avatar-fallback {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		flex-shrink: 0;
		font-size: 1.125rem;
		font-weight: 700;
		border-radius: 9999px;
	}

	.section-label {
		font: var(--type-label);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-tertiary);
	}

	.me-links {
		display: flex;
		flex-direction: column;
		background: var(--surface-raised);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.settings-card {
		display: flex;
		flex-direction: column;
	}

	.settings-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 44px;
		padding: 0.625rem 1rem;
	}

	.settings-row + .settings-row {
		border-top: 1px solid var(--line);
	}

	.settings-name {
		font: var(--type-body-strong);
		color: var(--text-primary);
	}

	.theme-toggle {
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: var(--radius-sm);
		cursor: pointer;
	}
</style>
