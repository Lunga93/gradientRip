<script lang="ts">
	export interface ButtonProps {
		label: string;
		onclick?: () => void;
		type?: 'button' | 'submit';
	}

	let { label, onclick, type = 'button' }: ButtonProps = $props();
</script>

<button class="ui-btn ui-btn-primary" type={type} onclick={onclick}>{label}</button>

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

	.ui-btn-primary {
		background: var(--accent);
		color: var(--text-on-accent);
	}

	.ui-btn-primary:hover {
		background: var(--accent-hover);
	}

	.ui-btn:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
</style>
