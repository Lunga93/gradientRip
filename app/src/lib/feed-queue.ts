let queue: string[] = [];
export const queueKudos = (routeId: string): void => {
	queue.push(routeId);
};
export const flushQueue = (): string[] => {
	const out = [...queue];
	queue = [];
	return out;
};
