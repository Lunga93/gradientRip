<script lang="ts" module>
	import { createRawSnippet } from 'svelte';
	import type { Snippet } from 'svelte';

	export interface ButtonProps {
		label: string;
		onclick?: () => void;
		type?: 'button' | 'submit';
	}

	function escapeHtml(value: string): string {
		return value
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	function makeButton(kind: 'btn-primary' | 'btn-secondary'): Snippet<[ButtonProps]> {
		return createRawSnippet<ButtonProps>((getProps) => ({
			render: () => {
				const props = getProps();
				return `<button class="btn ${kind}" type="${props.type ?? 'button'}">${escapeHtml(props.label)}</button>`;
			},
			setup: (element) => {
				const onClick = (): void => {
					getProps().onclick?.();
				};
				element.addEventListener('click', onClick);
				return () => {
					element.removeEventListener('click', onClick);
				};
			}
		}));
	}

	export const PrimaryButton: Snippet<[ButtonProps]> = makeButton('btn-primary');
	export const SecondaryButton: Snippet<[ButtonProps]> = makeButton('btn-secondary');
</script>

<style>
	:global(.btn) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.625rem 1.25rem;
		border: 1px solid transparent;
		border-radius: var(--radius-md);
		font: var(--type-body-strong);
		letter-spacing: 0.02em;
		cursor: pointer;
		text-decoration: none;
	}

	:global(.btn-primary) {
		background: var(--accent);
		color: var(--text-on-accent);
	}

	:global(.btn-primary:hover) {
		background: var(--accent-hover);
	}

	:global(.btn-secondary) {
		background: var(--surface-raised);
		border-color: var(--line-strong);
		color: var(--text-primary);
	}
</style>
