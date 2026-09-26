<script lang="ts">
	import { page } from '$app/state';
	import { TABS, isTabActive } from './nav.js';
</script>

<nav class="tabbar" aria-label="Primary">
	{#each TABS as tab (tab.key)}
		{@const active = isTabActive(tab.href, page.url.pathname)}
		<a
			href={tab.href}
			class="tab"
			class:active
			aria-current={active ? 'page' : undefined}
		>
			<span class="tab-label">{tab.label}</span>
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
</style>
