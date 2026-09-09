// Gradient classification thresholds — deliberately asymmetric.
// Downhill is more severe because braking is weaker than climbing (especially on full battery).
// See SPEC.md "Gradient bands are deliberately asymmetric" for rationale.
// Thresholds are set so common urban grades (3-7%) read as easy/working, not alarming.

export const THRESHOLDS = {
	pastBraking: -15,
	steepDescent: -10,
	watchSpeed: -6,
	easyGoing: 6,
	workingClimb: 12,
	hardClimb: 18
} as const;