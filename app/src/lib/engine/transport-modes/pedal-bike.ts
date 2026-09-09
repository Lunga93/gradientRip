import type { Mode } from '../plan-packet/types.js';

export const pedalBike: Mode = {
	label: 'Pedal bike',
	tag: 'Gears, lungs and lunch',
	group: 'human',
	unit: 'bike',
	human: true,
	climbNote: 'Expect to be out of the saddle — or off it, pushing — on that pitch.',
	phys: { cda: 0.95, crr: 0.006, eff: 0.24, usable: 1.0, speed: 20, vehicleKg: 12 },
	boards: [
		{ label: 'Road bike · 2×12', value: '1500|25|25' },
		{ label: 'Hardtail MTB · 1×12', value: '1500|30|30' },
		{ label: 'City 3-speed · coaster', value: '1500|15|20' }
	],
	brakeNote: 'Past this grade even good rim or disc brakes cook on a long descent — plan stops to let them cool or reroute.'
};