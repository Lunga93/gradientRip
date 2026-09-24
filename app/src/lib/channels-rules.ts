export const canReadChannel = (visibility: string, isMember: boolean): boolean =>
	visibility === 'open' || isMember;
