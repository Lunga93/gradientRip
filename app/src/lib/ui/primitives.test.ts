// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

const mockPage = vi.hoisted(() => ({
	url: { pathname: '/home' },
	data: {} as Record<string, unknown>,
	params: {} as Record<string, string>
}));
vi.mock('$app/state', () => ({ page: mockPage }));

import EmptyState from './EmptyState.svelte';
import StateBadge from './StateBadge.svelte';
import ErrorNotice from './ErrorNotice.svelte';
import PrimaryButton from './PrimaryButton.svelte';
import SecondaryButton from './SecondaryButton.svelte';
import FeedItem from './FeedItem.svelte';
import ListRow from './ListRow.svelte';
import ScreenHeader from './ScreenHeader.svelte';
import TabBar from './TabBar.svelte';
import AppShell from './AppShell.svelte';
import { social } from '$lib/social.svelte.js';
import { feed } from '$lib/feed.svelte.js';

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
	mockPage.url.pathname = '/home';
	mockPage.data = {};
	social.incoming = [];
	feed.unread = 0;
});

describe('EmptyState', () => {
	it('renders title, body and action, and fires onAction', async () => {
		const onAction = vi.fn();
		render(EmptyState, {
			props: { title: 'No routes yet', body: 'Be the first.', actionLabel: 'Publish', onAction }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
		expect(screen.getByRole('heading', { name: 'No routes yet' })).toBeTruthy();
		expect(onAction).toHaveBeenCalledOnce();
	});
});

describe('StateBadge', () => {
	it('renders a solid badge with the label', () => {
		render(StateBadge, { props: { label: 'LIVE', tone: 'go' } });
		expect(screen.getByText('LIVE')).toBeTruthy();
	});
});

describe('ErrorNotice', () => {
	it('shows message and retry', async () => {
		const onRetry = vi.fn();
		render(ErrorNotice, { props: { message: 'Offline.', onRetry } });
		await fireEvent.click(screen.getByRole('button', { name: /retry/i }));
		expect(onRetry).toHaveBeenCalledOnce();
	});
});

describe('Buttons', () => {
	it('renders primary button, stays reactive on label change, fires onclick', async () => {
		const onclick = vi.fn();
		const { rerender } = render(PrimaryButton, { props: { label: 'Save', onclick } });
		const btn = screen.getByRole('button', { name: 'Save' });
		expect(btn.getAttribute('type')).toBe('button');
		await fireEvent.click(btn);
		expect(onclick).toHaveBeenCalledOnce();
		await rerender({ label: 'Saved', onclick });
		expect(screen.getByRole('button', { name: 'Saved' })).toBeTruthy();
	});

	it('renders secondary button with submit type', () => {
		render(SecondaryButton, { props: { label: 'Cancel', type: 'submit' } });
		expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('type')).toBe('submit');
	});
});

describe('FeedItem', () => {
	it('renders header, body and actions slots', () => {
		render(FeedItem, {
			props: {
				header: createRawSnippet(() => ({ render: () => '<span>Feed header</span>' })),
				body: createRawSnippet(() => ({ render: () => '<p>Feed body</p>' })),
				actions: createRawSnippet(() => ({ render: () => '<button>Kudos</button>' }))
			}
		});
		expect(screen.getByText('Feed header')).toBeTruthy();
		expect(screen.getByText('Feed body')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Kudos' })).toBeTruthy();
	});

	it('composes nested Phase-B-style content in the body slot', () => {
		render(FeedItem, {
			props: {
				header: createRawSnippet(() => ({ render: () => '<span>H</span>' })),
				body: createRawSnippet(() => ({
					render: () =>
						'<div><p>Sunrise Loop <strong>12 riders</strong></p><span>GOING</span></div>'
				})),
				actions: createRawSnippet(() => ({ render: () => '<span>A</span>' }))
			}
		});
		expect(screen.getByText('Sunrise Loop')).toBeTruthy();
		expect(screen.getByText('12 riders')).toBeTruthy();
		expect(screen.getByText('GOING')).toBeTruthy();
	});
});

describe('ListRow href', () => {
	it('accepts a previously-unlisted route href', () => {
		render(ListRow, { props: { title: 'Routes', href: '/explore/routes' } });
		const link = screen.getByRole('link');
		expect(link.getAttribute('href')).toBe('/explore/routes');
	});
});

describe('ScreenHeader backHref', () => {
	it('accepts a previously-unlisted back href', () => {
		render(ScreenHeader, { props: { title: 'Route', backHref: '/explore/routes' } });
		const back = screen.getByRole('link', { name: 'Back' });
		expect(back.getAttribute('href')).toBe('/explore/routes');
	});
});

describe('TabBar', () => {
	it('renders five tabs with aria-current on the active one', () => {
		mockPage.url.pathname = '/map';
		render(TabBar);
		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(5);
		expect(screen.getByRole('link', { name: /Map/ }).getAttribute('aria-current')).toBe('page');
		const actives = links.filter((a) => a.getAttribute('aria-current') === 'page');
		expect(actives).toHaveLength(1);
	});

	it('badge carries the full count in its aria-label', () => {
		mockPage.url.pathname = '/home';
		social.incoming = Array.from({ length: 7 }, (_, i) => ({
			id: `req-${i}`,
			display_name: `Buddy ${i}`,
			avatar_url: null,
			created_at: new Date().toISOString()
		}));
		feed.unread = 5;
		render(TabBar);
		const badge = screen.getByRole('status');
		expect(badge.getAttribute('aria-label')).toBe('12 activity updates');
		expect(badge.textContent?.trim()).toBe('9+');
	});
});

describe('AppShell', () => {
	it('hides the TabBar when noTabs is true', () => {
		mockPage.url.pathname = '/ride';
		mockPage.data = { noTabs: true };
		render(AppShell, {
			props: { children: createRawSnippet(() => ({ render: () => '<p>ride</p>' })) }
		});
		expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
		expect(screen.getByText('ride')).toBeTruthy();
	});

	it('shows the TabBar otherwise', () => {
		mockPage.url.pathname = '/home';
		mockPage.data = {};
		render(AppShell, {
			props: { children: createRawSnippet(() => ({ render: () => '<p>home</p>' })) }
		});
		expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
	});
});
