export const previewRoute = (v: { isMember: boolean; hasLink: boolean }): boolean =>
	!v.isMember && !v.hasLink;

export const publicStartDistanceM = (): number => 200;
