import type { Mode } from '../plan-packet/types.js';

/** Total mass = rider + kit + vehicle for the active mode. */
export const totalMass = (mode: Mode): number => {
	return 110 + mode.phys.vehicleKg; // RIDER_KIT_KG + vehicleKg
};