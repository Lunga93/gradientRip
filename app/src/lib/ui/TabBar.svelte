<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { TABS, isTabActive } from './nav.js';
	import { social } from '$lib/social.svelte.js';
	import { feed } from '$lib/feed.svelte.js';
</script>

<nav class="tabbar" aria-label="Primary">
	{#each TABS as tab (tab.key)}
		{@const active = isTabActive(tab.href, page.url.pathname)}
		{@const badge = tab.key === 'activity' ? social.incoming.length + feed.unread : 0}
		<a
			href={resolve(tab.href)}
			class="tab"
			class:active
			aria-current={active ? 'page' : undefined}
		>
			<span class="tab-label">{tab.label}{#if badge > 0}<span
						class="tab-badge"
						aria-label="{badge} activity updates"
					>{badge > 9 ? '9+' : badge}</span
				>{/if}</span>
			<span class="tab-indicator" aria-hidden="true"></span>
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: sticky;
		bottom: 0;
		z-index: 20;
		display: flex;
		background: var(--surface-page);
		border-top: 1px solid var(--line);
	}

	.tab {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.25rem;
		min-height: 44px;
		padding: 0.625rem 0.25rem 0.5rem;
		text-decoration: none;
		color: var(--text-secondary);
		font: var(--type-label);
		letter-spacing: 0.02em;
	}

	.tab:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.tab.active {
		color: var(--text-primary);
	}

	.tab-indicator {
		height: 3px;
		width: 1.5rem;
		border-radius: 999px;
		background: transparent;
	}

	.tab.active .tab-indicator {
		background: var(--accent);
	}

	.tab-label {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
	}

	.tab-badge {
		display: inline-grid;
		place-items: center;
		min-width: 20px;
		min-height: 20px;
		padding: 0 0.375rem;
		border-radius: 9999px;
		background: var(--state-stop);
		color: #fff;
		font: var(--type-label);
	}
</style>
