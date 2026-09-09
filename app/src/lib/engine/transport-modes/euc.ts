import type { Mode } from '../plan-packet/types.js';

export const euc: Mode = {
	label: 'EUC / Onewheel',
	tag: 'Climbs anything, nosedives downhill',
	group: 'electric',
	unit: 'wheel',
	climbNote: 'Expect tilt-back and beeping alarms on that pitch — the wheel will be at its torque limit.',
	phys: { cda: 0.7, crr: 0.015, eff: 0.85, usable: 0.88, speed: 20, vehicleKg: 12 },
	boards: [
		{ label: 'Onewheel-class · 500 Wh', value: '500|25|10' },
		{ label: 'EUC mid · 1000 Wh', value: '1000|30|12' },
		{ label: 'EUC long-range · 1500 Wh', value: '1500|30|12' }
	],
	brakeNote: 'Self-balancing wheels climb hard but overspeed downhill — past this grade you risk pedal tilt-back or cutout. Do not ride it.'
};