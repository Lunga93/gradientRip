import type { Mode } from '../plan-packet/types.js';

export const eskate: Mode = {
	label: 'E-skate',
	tag: 'Boards that grind uphill, brakes that fear downhill',
	group: 'electric',
	unit: 'board',
	climbNote: 'Expect the motors to labour, speed to drop sharply, and range to run worse than estimated on that stretch.',
	phys: { cda: 0.65, crr: 0.02, eff: 0.8, usable: 0.87, speed: 22, vehicleKg: 6.8 },
	boards: [
		{ label: 'Journ-E Phantom · 336 Wh', value: '336|30|12' },
		{ label: 'Budget single-motor · 200 Wh', value: '200|20|10' },
		{ label: 'Off-road dual-motor · 450 Wh', value: '450|35|15' }
	],
	brakeNote: "That's a braking problem, not an effort problem — worst right after a full charge, when electronic braking is weakest. Don't ride this leg unless you know it and can footbrake it."
};