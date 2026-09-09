import type { Mode } from '../plan-packet/types.js';

export const ebike: Mode = {
	label: 'E-bike',
	tag: 'Gears climb, hydraulic discs stop',
	group: 'electric',
	unit: 'bike',
	climbNote: 'Expect to drop to the granny gear and grind — speed will fall off and the battery will drain faster than estimated there.',
	phys: { cda: 0.95, crr: 0.008, eff: 0.85, usable: 0.9, speed: 25, vehicleKg: 22 },
	boards: [
		{ label: 'City commuter · 500 Wh', value: '500|25|22' },
		{ label: 'Cargo longtail · 750 Wh', value: '750|22|20' },
		{ label: 'Ultralight road · 360 Wh', value: '360|28|25' }
	],
	brakeNote: "That's past what this bike's brakes can hold comfortably on a sustained descent — walk it, reroute, or expect serious brake fade."
};