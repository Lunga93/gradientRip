export type VerdictLevel = 'fly' | 'ok' | 'caution' | 'stop';

export interface VerdictStyle {
	label: string;
	color: string;
}

export const VERDICT_STYLE: Record<VerdictLevel, VerdictStyle> = {
	fly: { label: "YOU'RE GONNA FLY", color: 'var(--v-fly)' },
	ok: { label: 'GO', color: 'var(--v-go)' },
	caution: { label: 'WATCH IT', color: 'var(--v-caution)' },
	stop: { label: 'STOP', color: 'var(--v-stop)' }
};

export const verdictColor = (level: string): string =>
	VERDICT_STYLE[level as VerdictLevel]?.color ?? 'var(--color-primary)';

export const verdictLabel = (level: string): string =>
	VERDICT_STYLE[level as VerdictLevel]?.label ?? level.toUpperCase();

export const VERDICT_HEX: Record<VerdictLevel, string> = {
	fly: '#93c5fd',
	ok: '#34d399',
	caution: '#fbbf24',
	stop: '#f87171'
};

export const verdictHex = (level: string): string =>
	VERDICT_HEX[level as VerdictLevel] ?? '#60a5fa';
