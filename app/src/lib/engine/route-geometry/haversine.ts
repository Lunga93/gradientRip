// Haversine distance between two lat/lon points in meters.

export const haversine = (a: [number, number], b: [number, number]): number => {
	const R = 6371000;
	const [lat1, lon1] = a;
	const [lat2, lon2] = b;
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLon = toRad(lon2 - lon1);
	const s =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(s));
};