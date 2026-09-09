import type { RouteSegment, LatLon } from '../plan-packet/types.js';

/** Merge consecutive same-colour segments for efficient rendering. */
export const mergePolylines = (segs: RouteSegment[]): { c: string; pts: LatLon[] }[] => {
	const groups: { c: string; pts: LatLon[] }[] = [];
	let cur: { c: string; pts: LatLon[] } | null = null;
	for (const s of segs) {
		if (!cur || cur.c !== s.c) {
			if (cur) groups.push(cur);
			cur = { c: s.c, pts: [s.a, s.b] };
		} else {
			cur.pts.push(s.b);
		}
	}
	if (cur) groups.push(cur);
	return groups;
};