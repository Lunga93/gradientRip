/** Binary search for grade at a specific distance along the resampled profile. */
export const gradeAt = (dist: number, cum: number[], elev: number[]): number => {
	let lo = 1;
	let hi = cum.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (cum[mid] < dist) lo = mid + 1;
		else hi = mid;
	}
	const i = Math.min(lo, cum.length - 1);
	const d = Math.max(1, cum[i] - cum[i - 1]);
	return ((elev[i] - elev[i - 1]) / d) * 100;
};