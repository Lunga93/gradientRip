/** 3-point moving average — suppresses DEM noise. */
export const smooth3 = (arr: number[]): number[] => {
	if (arr.length < 3) return arr.slice();
	const out = arr.slice();
	for (let i = 1; i < arr.length - 1; i++) {
		out[i] = (arr[i - 1] + arr[i] + arr[i + 1]) / 3;
	}
	return out;
};

/** 5-point moving average — stronger noise suppression for grade display. */
export const smooth5 = (arr: number[]): number[] => {
	if (arr.length < 5) return smooth3(arr);
	const out = arr.slice();
	for (let i = 2; i < arr.length - 2; i++) {
		out[i] = (arr[i - 2] + arr[i - 1] + arr[i] + arr[i + 1] + arr[i + 2]) / 5;
	}
	return out;
};