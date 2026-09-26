// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EmptyState from './EmptyState.svelte';
import StateBadge from './StateBadge.svelte';
import ErrorNotice from './ErrorNotice.svelte';
import PrimaryButton from './PrimaryButton.svelte';
import SecondaryButton from './SecondaryButton.svelte';

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
