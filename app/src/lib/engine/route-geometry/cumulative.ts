import { haversine } from './haversine.js';

/** Cumulative distance along a polyline (meters). */
export const cumulative = (line: [number, number][]): number[] => {
	const cum = [0];
	for (let i = 1; i < line.length; i++) cum.push(cum[i - 1] + haversine(line[i - 1], line[i]));
	return cum;
};