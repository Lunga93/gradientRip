import { G, RHO } from './constants.js';
import type { Phys } from '../plan-packet/types.js';

/** Calculate energy (Wh) for a segment at constant grade and speed. */
export const segWh = (
	distance: number,
	grade: number,
	mass: number,
	vKmh?: number,
	phys?: Phys
): number => {
	const p = phys ?? { cda: 0.65, crr: 0.02, eff: 0.8, usable: 0.87, speed: 22, vehicleKg: 6.8 };
	const v = (vKmh ?? p.speed) / 3.6;
	const fRoll = p.crr * mass * G;
	const fAir = 0.5 * RHO * p.cda * v * v;
	const fGrav = mass * G * Math.sin(Math.atan(grade));
	const f = Math.max(0, fRoll + fAir + fGrav); // clamped: no regen credited
	return (f * distance) / p.eff / 3600;
};