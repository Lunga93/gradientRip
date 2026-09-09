import type { Mode } from '../plan-packet/types.js';

export const pushSkate: Mode = {
	label: 'Push skate',
	tag: 'Your legs are the motor, your shoe is the brake',
	group: 'human',
	unit: 'board',
	human: true,
	climbNote: "You won't be pushing up that — expect to walk the board up on foot.",
	phys: { cda: 0.65, crr: 0.02, eff: 0.24, usable: 1.0, speed: 12, vehicleKg: 4 },
	boards: [
		{ label: 'Longboard 38" · push', value: '1200|8|12' },
		{ label: 'Double-drop LDP · push', value: '1200|7|12' },
		{ label: 'Cruiser 30" · push', value: '1200|6|10' }
	],
	brakeNote: 'Footbraking has a hard limit — past this grade expect the shoe to smoke and the speed to keep building. Walk it.'
};