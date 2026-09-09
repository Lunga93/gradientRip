import type { RouteSegment, LatLon } from '../plan-packet/types.js';
import { gradeAt } from './grade-at.js';
import { classify } from '../gradient-bands/classify.js';

/** Build colored segments for the full-resolution route line. */
export const routeSegments = (
	line: LatLon[],
	lineCum: number[],
	pts: LatLon[],
	elev: number[],
	cum: number[]
): RouteSegment[] => {
	const segs: RouteSegment[] = [];
	for (let i = 1; i < line.length; i++) {
		const mid = (lineCum[i - 1] + lineCum[i]) / 2;
		const grade = gradeAt(mid, cum, elev);
		const { c, k } = classify(grade);
		segs.push({ a: line[i - 1], b: line[i], c, k, grade });
	}
	return segs;
};