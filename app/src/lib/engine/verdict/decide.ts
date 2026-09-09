import type { Mode, Verdict, RouteSegment } from '../plan-packet/types.js';

/** Determine if a route is OK, Caution, or Stop for the given mode/board. */
export const decide = (
	segs: RouteSegment[],
	totalWh: number,
	usableWh: number,
	climbLimit: number,
	brakeLimit: number,
	mode: Mode
): Verdict => {
	const worstDescent = Math.min(0, ...segs.map((s) => s.grade));
	const worstClimb = Math.max(0, ...segs.map((s) => s.grade));
	const kcal = (wh: number) => (wh * 0.86).toFixed(0);

	if (Math.abs(worstDescent) >= brakeLimit) {
		return {
			level: 'stop',
			badge: 'Stop',
			text: `This route drops at up to ${Math.abs(worstDescent).toFixed(0)}%, past this ${mode.unit}'s ${brakeLimit}% braking limit. ${mode.brakeNote}`
		};
	}
	if (totalWh > usableWh) {
		return {
			level: 'stop',
			badge: 'Stop',
			text: mode.human
				? `Estimated effort (${kcal(totalWh)} kcal) is beyond a comfortable day's output (${kcal(usableWh)} kcal). Shorten the route or plan a proper food stop.`
				: `Estimated energy use (${totalWh.toFixed(0)} Wh) exceeds this ${mode.unit}'s usable capacity (${usableWh.toFixed(0)} Wh). You will not make this distance on one charge.`
		};
	}
	if (worstClimb >= climbLimit) {
		return {
			level: 'caution',
			badge: 'Caution',
			text: `Peak climb of ${worstClimb.toFixed(0)}% is at or beyond this ${mode.unit}'s rated climb limit (${climbLimit}%). ${mode.climbNote}`
		};
	}
	if (totalWh > usableWh * 0.7) {
		return {
			level: 'caution',
			badge: 'Caution',
			text: mode.human
				? `This route burns ${(totalWh / usableWh * 100).toFixed(0)}% of a comfortable day's effort one way. Fine as a single leg, heavy as a round trip.`
				: `This route uses ${(totalWh / usableWh * 100).toFixed(0)}% of usable battery one way. Fine for a single leg, tight for a round trip without charging in between.`
		};
	}
	return {
		level: 'ok',
		badge: 'OK',
		text: mode.human
			? `Comfortably within a day's effort and within this ${mode.unit}'s climb and braking limits — ${kcal(totalWh)} kcal, ${(totalWh / usableWh * 100).toFixed(0)}% of the day's budget.`
			: `Comfortably within range and within this ${mode.unit}'s climb and braking limits — ${totalWh.toFixed(0)} Wh, ${(totalWh / usableWh * 100).toFixed(0)}% of usable battery.`
	};
};