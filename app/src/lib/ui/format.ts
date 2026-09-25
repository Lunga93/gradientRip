// app/src/lib/ui/format.ts
export const relTime = (ts: number, now: number = Date.now()): string => {
	const diff = Math.max(0, now - ts);
	if (diff < 60_000) return 'just now';
	if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
	if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
	return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export const fmtKm = (km: number): string => `${km.toFixed(1)} km`;

export const fmtCount = (n: number): string =>
	n < 1000 ? `${n}` : `${(Math.floor(n / 100) / 10).toString()}k`;
