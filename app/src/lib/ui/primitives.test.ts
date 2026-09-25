// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';
import StateBadge from './StateBadge.svelte';
import ErrorNotice from './ErrorNotice.svelte';

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
