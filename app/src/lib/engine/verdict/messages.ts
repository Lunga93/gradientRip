// Verdict message templates — used by decide.ts
// Kept separate for potential i18n or A/B testing.

export const messages = {
	stop: {
		braking: (modeUnit: string, worstDescent: number, brakeLimit: string, brakeNote: string) =>
			`This route drops at up to ${worstDescent.toFixed(0)}%, past this ${modeUnit}'s ${brakeLimit}% braking limit. ${brakeNote}`,
		energy: {
			human: (totalKcal: string, usableKcal: string) =>
				`Estimated effort (${totalKcal} kcal) is beyond a comfortable day's output (${usableKcal} kcal). Shorten the route or plan a proper food stop.`,
			electric: (modeUnit: string, totalWh: string, usableWh: string) =>
				`Estimated energy use (${totalWh} Wh) exceeds this ${modeUnit}'s usable capacity (${usableWh} Wh). You will not make this distance on one charge.`
		}
	},
	caution: {
		climb: (modeUnit: string, worstClimb: number, climbLimit: number, climbNote: string) =>
			`Peak climb of ${worstClimb.toFixed(0)}% is at or beyond this ${modeUnit}'s rated climb limit (${climbLimit}%). ${climbNote}`,
		energy: {
			human: (pct: string) =>
				`This route burns ${pct}% of a comfortable day's effort one way. Fine as a single leg, heavy as a round trip.`,
			electric: (modeUnit: string, pct: string) =>
				`This route uses ${pct}% of usable battery one way. Fine for a single leg, tight for a round trip without charging in between.`
		}
	},
	ok: {
		human: (totalKcal: string, pct: string, modeUnit: string) =>
			`Comfortably within a day's effort and within this ${modeUnit}'s climb and braking limits — ${totalKcal} kcal, ${pct}% of the day's budget.`,
		electric: (modeUnit: string, totalWh: string, pct: string) =>
			`Comfortably within range and within this ${modeUnit}'s climb and braking limits — ${totalWh} Wh, ${pct}% of usable battery.`
	}
} as const;