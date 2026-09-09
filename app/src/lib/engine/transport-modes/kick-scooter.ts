import type { Mode } from '../plan-packet/types.js';

export const kickScooter: Mode = {
	label: 'Kick scooter',
	tag: 'Kick, coast, repeat',
	group: 'human',
	unit: 'scooter',
	human: true,
	climbNote: "You won't be scooting up that — expect to walk it.",
	phys: { cda: 0.8, crr: 0.01, eff: 0.24, usable: 1.0, speed: 12, vehicleKg: 5 },
	boards: [
		{ label: 'Adult big-wheel · 200 mm', value: '900|7|10' },
		{ label: 'Standard · 145 mm', value: '900|5|8' },
		{ label: 'Dirt scoot · 2×26"', value: '900|6|10' }
	],
	brakeNote: "A heel brake on tiny wheels can only do so much — past this grade you'll be running it out or bailing. Walk it."
};