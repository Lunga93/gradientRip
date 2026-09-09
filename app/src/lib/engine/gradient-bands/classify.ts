import { THRESHOLDS } from './thresholds.js';
import type { Band } from '../plan-packet/types.js';

/** Classify a grade percentage into a gradient band. */
export const classify = (gradePct: number): Band => {
	const g = gradePct;
	if (g <= THRESHOLDS.pastBraking) return { c: '#4a1420', k: 'past braking' };
	if (g <= THRESHOLDS.steepDescent) return { c: '#b5502e', k: 'steep descent' };
	if (g <= THRESHOLDS.watchSpeed) return { c: '#c98a2c', k: 'watch your speed' };
	if (g < THRESHOLDS.easyGoing) return { c: '#6b8f4e', k: 'easy going' };
	if (g < THRESHOLDS.workingClimb) return { c: '#8fae7a', k: 'working climb' };
	if (g < THRESHOLDS.hardClimb) return { c: '#c98a2c', k: 'hard climb' };
	return { c: '#b5502e', k: 'at the motor limit' };
};