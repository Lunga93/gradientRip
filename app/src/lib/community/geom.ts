export const geomHash = (line: [number, number][], sport: string): string => {
	const rounded = line.map(([lat, lon]) => `${lat.toFixed(5)},${lon.toFixed(5)}`).join(';');
	let h = 0;
	const s = `${sport}|${rounded}`;
	for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
	return `g${(h >>> 0).toString(16)}`;
};
