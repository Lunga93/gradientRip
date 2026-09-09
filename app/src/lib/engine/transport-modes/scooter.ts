import type { Mode } from '../plan-packet/types.js';

export const scooter: Mode = {
	label: 'E-scooter',
	tag: 'Small wheels, short braking margin',
	group: 'electric',
	unit: 'scooter',
	climbNote: 'Expect the motors to bog down and speed to collapse on that pitch — small wheels stall fast on steep grades.',
	phys: { cda: 0.8, crr: 0.012, eff: 0.82, usable: 0.88, speed: 22, vehicleKg: 14 },
	boards: [
		{ label: 'Commuter · 350 Wh', value: '350|18|12' },
		{ label: 'Dual-motor · 600 Wh', value: '600|25|15' },
		{ label: 'Lightweight · 250 Wh', value: '250|15|10' }
	],
	brakeNote: 'Small wheels and short wheelbase make steep descents sketchy fast — past this limit the scooter can out-brake its own stability. Reroute.'
};