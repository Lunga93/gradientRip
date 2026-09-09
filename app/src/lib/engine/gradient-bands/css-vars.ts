import { THRESHOLDS } from './thresholds.js';

/** CSS variable reference for a grade percentage (used in map/profile rendering). */
export const cssVar = (gradePct: number): string => {
	const g = gradePct;
	if (g <= THRESHOLDS.pastBraking) return 'var(--band-stop, #4a1420)';
	if (g <= THRESHOLDS.steepDescent) return 'var(--band-steepd, #b5502e)';
	if (g <= THRESHOLDS.watchSpeed) return 'var(--band-watch, #c98a2c)';
	if (g < THRESHOLDS.easyGoing) return 'var(--band-easy, #6b8f4e)';
	if (g < THRESHOLDS.workingClimb) return 'var(--band-work, #8fae7a)';
	if (g < THRESHOLDS.hardClimb) return 'var(--band-hard, #a4630a)';
	return 'var(--band-limit, #b5502e)';
};