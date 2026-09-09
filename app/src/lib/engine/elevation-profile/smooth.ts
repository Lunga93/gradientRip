/** 3-point moving average — suppresses DEM noise. */
export const smooth3 = (arr: number[]): number[] => {
	if (arr.length < 3) return arr.slice();
	const out = arr.slice();
	for (let i = 1; i < arr.length - 1; i++) {
		out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3;
	}
	return out;
};