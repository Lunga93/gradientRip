import { THRESHOLDS } from './thresholds.js';

/** CSS variable reference for a grade percentage (used in map/profile rendering). */
export const cssVar = (gradePct: number): string => {
	const g = gradePct;
	if (g <= THRESHOLDS.pastBraking) return 'var(--band-stop, #dc2626)';
	if (g <= THRESHOLDS.steepDescent) return 'var(--band-steepd, #ea580c)';
	if (g <= THRESHOLDS.watchSpeed) return 'var(--band-watch, #eab308)';
	if (g < THRESHOLDS.easyGoing) return 'var(--band-easy, #16a34a)';
	if (g < THRESHOLDS.workingClimb) return 'var(--band-work, #65a30d)';
	if (g < THRESHOLDS.hardClimb) return 'var(--band-hard, #ea580c)';
	return 'var(--band-limit, #dc2626)';
};