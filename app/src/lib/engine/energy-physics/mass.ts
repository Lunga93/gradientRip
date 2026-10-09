import type { Mode } from '../plan-packet/types.js';

export const totalMass = (mode: Mode): number => {
	return 110 + mode.phys.vehicleKg;
};