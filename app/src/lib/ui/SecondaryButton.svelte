<script lang="ts">
	export interface ButtonProps {
		label: string;
		onclick?: () => void;
		type?: 'button' | 'submit';
		disabled?: boolean;
		title?: string;
		ariaLabel?: string;
		ariaPressed?: boolean;
	}

	let {
		label,
		onclick,
		type = 'button',
		disabled = false,
		title,
		ariaLabel,
		ariaPressed
	}: ButtonProps = $props();
</script>

<button
	class="ui-btn ui-btn-secondary"
	type={type}
	{disabled}
	onclick={onclick}
	title={title}
	aria-label={ariaLabel}
	aria-pressed={ariaPressed}>{label}</button>

<style>
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

	.ui-btn-secondary {
		background: var(--surface-raised);
		border-color: var(--line-strong);
		color: var(--text-primary);
	}

	/* Toggle-pressed state (composer Everyone/Friends, video quality):
	   solid accent fill + inverted text, so the selected option is distinct
	   by fill, not color-alone. */
	.ui-btn-secondary[aria-pressed='true'] {
		background: var(--accent);
		border-color: transparent;
		color: var(--text-on-accent);
	}

	.ui-btn-secondary:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.ui-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
