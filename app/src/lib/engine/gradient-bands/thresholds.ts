// Gradient classification thresholds — deliberately asymmetric.
// Downhill is more severe because braking is weaker than climbing (especially on full battery).
// See SPEC.md "Gradient bands are deliberately asymmetric" for rationale.

export const THRESHOLDS = {
	pastBraking: -12,
	steepDescent: -8,
	watchSpeed: -4,
	easyGoing: 4,
	workingClimb: 10,
	hardClimb: 15
} as const;