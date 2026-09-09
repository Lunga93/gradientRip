import type { RouteSegment, LatLon } from '../plan-packet/types.js';
import { gradeAt } from './grade-at.js';
import { classify } from '../gradient-bands/classify.js';
import { smooth5 } from '../elevation-profile/smooth.js';

/** Build colored segments for the full-resolution route line. */
export const routeSegments = (
	line: LatLon[],
	lineCum: number[],
	pts: LatLon[],
	elev: number[],
	cum: number[]
): RouteSegment[] => {
	const segs: RouteSegment[] = [];
	const rawGrades: number[] = [];
	for (let i = 1; i < line.length; i++) {
		const mid = (lineCum[i - 1] + lineCum[i]) / 2;
		const grade = gradeAt(mid, cum, elev);
		rawGrades.push(grade);
	}
	const smoothedGrades = smooth5(rawGrades);
	for (let i = 1; i < line.length; i++) {
		const { c, k } = classify(smoothedGrades[i - 1] ?? 0);
		segs.push({ a: line[i - 1], b: line[i], c, k, grade: smoothedGrades[i - 1] ?? 0 });
	}
	return segs;
};