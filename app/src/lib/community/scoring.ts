export const routeScore = (rides: number, saves: number, kudos: number, ageDays: number): number =>
	Math.log(1 + rides + saves * 2 + kudos) - ageDays / 30;

export const fitBadge = (
	totalWh: number, usableWh: number, worstClimb: number, climbLimit: number, worstDescent: number, brakeLimit: number
): 'fly' | 'ok' | 'caution' | 'stop' => {
	if (Math.abs(worstDescent) >= brakeLimit) return 'stop';
	if (totalWh > usableWh) return 'stop';
	if (worstClimb >= climbLimit || totalWh > usableWh * 0.7) return 'caution';
	if (totalWh < usableWh * 0.3) return 'fly';
	return 'ok';
};
