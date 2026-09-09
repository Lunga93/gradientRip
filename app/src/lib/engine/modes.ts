// Transport modes — ported verbatim from the legacy app (index.html).
// E-skate defaults match the original validated model exactly
// (CDA 0.65, CRR 0.02, EFF 0.80, USABLE 0.87 — see SPEC.md regression values).

export interface Phys {
	cda: number;
	crr: number;
	eff: number;
	usable: number;
	speed: number;
	vehicleKg: number;
}

export interface Board {
	label: string;
	value: string; // "capWh|climbLimit|brakeLimit"
}

export interface Mode {
	label: string;
	tag: string;
	group: 'electric' | 'human';
	unit: string;
	human?: boolean;
	climbNote: string;
	phys: Phys;
	boards: Board[];
	brakeNote: string;
}

export const G = 9.81;
export const RHO = 1.2;
export const RIDER_KIT_KG = 110; // rider + kit; vehicle mass comes from the active mode
export const NOMINATIM_DELAY_MS = 1100; // respects 1 req/sec usage policy

export const MODES: Record<string, Mode> = {
	eskate: {
		label: 'E-skate', tag: 'Boards that grind uphill, brakes that fear downhill',
		group: 'electric', unit: 'board',
		climbNote: 'Expect the motors to labour, speed to drop sharply, and range to run worse than estimated on that stretch.',
		phys: { cda: 0.65, crr: 0.02, eff: 0.8, usable: 0.87, speed: 22, vehicleKg: 6.8 },
		boards: [
			{ label: 'Journ-E Phantom · 336 Wh', value: '336|30|12' },
			{ label: 'Budget single-motor · 200 Wh', value: '200|20|10' },
			{ label: 'Off-road dual-motor · 450 Wh', value: '450|35|15' }
		],
		brakeNote: "That's a braking problem, not an effort problem — worst right after a full charge, when electronic braking is weakest. Don't ride this leg unless you know it and can footbrake it."
	},
	ebike: {
		label: 'E-bike', tag: 'Gears climb, hydraulic discs stop',
		group: 'electric', unit: 'bike',
		climbNote: 'Expect to drop to the granny gear and grind — speed will fall off and the battery will drain faster than estimated there.',
		phys: { cda: 0.95, crr: 0.008, eff: 0.85, usable: 0.9, speed: 25, vehicleKg: 22 },
		boards: [
			{ label: 'City commuter · 500 Wh', value: '500|25|22' },
			{ label: 'Cargo longtail · 750 Wh', value: '750|22|20' },
			{ label: 'Ultralight road · 360 Wh', value: '360|28|25' }
		],
		brakeNote: "That's past what this bike's brakes can hold comfortably on a sustained descent — walk it, reroute, or expect serious brake fade."
	},
	scooter: {
		label: 'E-scooter', tag: 'Small wheels, short braking margin',
		group: 'electric', unit: 'scooter',
		climbNote: 'Expect the motors to bog down and speed to collapse on that pitch — small wheels stall fast on steep grades.',
		phys: { cda: 0.8, crr: 0.012, eff: 0.82, usable: 0.88, speed: 22, vehicleKg: 14 },
		boards: [
			{ label: 'Commuter · 350 Wh', value: '350|18|12' },
			{ label: 'Dual-motor · 600 Wh', value: '600|25|15' },
			{ label: 'Lightweight · 250 Wh', value: '250|15|10' }
		],
		brakeNote: 'Small wheels and short wheelbase make steep descents sketchy fast — past this limit the scooter can out-brake its own stability. Reroute.'
	},
	euc: {
		label: 'EUC / Onewheel', tag: 'Climbs anything, nosedives downhill',
		group: 'electric', unit: 'wheel',
		climbNote: 'Expect tilt-back and beeping alarms on that pitch — the wheel will be at its torque limit.',
		phys: { cda: 0.7, crr: 0.015, eff: 0.85, usable: 0.88, speed: 20, vehicleKg: 12 },
		boards: [
			{ label: 'Onewheel-class · 500 Wh', value: '500|25|10' },
			{ label: 'EUC mid · 1000 Wh', value: '1000|30|12' },
			{ label: 'EUC long-range · 1500 Wh', value: '1500|30|12' }
		],
		brakeNote: 'Self-balancing wheels climb hard but overspeed downhill — past this grade you risk pedal tilt-back or cutout. Do not ride it.'
	},
	/* Human-powered modes: same energy integration, but the motor is you.
	   Muscular efficiency (~24%) replaces drivetrain efficiency, so Wh here is
	   metabolic energy; the UI shows it in kcal. The budget is a comfortable
	   day's output, fully available (usable 1.0) — no BMS cutoff on legs. */
	push: {
		label: 'Push skate', tag: 'Your legs are the motor, your shoe is the brake',
		group: 'human', unit: 'board', human: true,
		climbNote: "You won't be pushing up that — expect to walk the board up on foot.",
		phys: { cda: 0.65, crr: 0.02, eff: 0.24, usable: 1.0, speed: 12, vehicleKg: 4 },
		boards: [
			{ label: 'Longboard 38" · push', value: '1200|8|12' },
			{ label: 'Double-drop LDP · push', value: '1200|7|12' },
			{ label: 'Cruiser 30" · push', value: '1200|6|10' }
		],
		brakeNote: 'Footbraking has a hard limit — past this grade expect the shoe to smoke and the speed to keep building. Walk it.'
	},
	bike: {
		label: 'Pedal bike', tag: 'Gears, lungs and lunch',
		group: 'human', unit: 'bike', human: true,
		climbNote: 'Expect to be out of the saddle — or off it, pushing — on that pitch.',
		phys: { cda: 0.95, crr: 0.006, eff: 0.24, usable: 1.0, speed: 20, vehicleKg: 12 },
		boards: [
			{ label: 'Road bike · 2×12', value: '1500|25|25' },
			{ label: 'Hardtail MTB · 1×12', value: '1500|30|30' },
			{ label: 'City 3-speed · coaster', value: '1500|15|20' }
		],
		brakeNote: 'Past this grade even good rim or disc brakes cook on a long descent — plan stops to let them cool or reroute.'
	},
	kick: {
		label: 'Kick scooter', tag: 'Kick, coast, repeat',
		group: 'human', unit: 'scooter', human: true,
		climbNote: "You won't be scooting up that — expect to walk it.",
		phys: { cda: 0.8, crr: 0.01, eff: 0.24, usable: 1.0, speed: 12, vehicleKg: 5 },
		boards: [
			{ label: 'Adult big-wheel · 200 mm', value: '900|7|10' },
			{ label: 'Standard · 145 mm', value: '900|5|8' },
			{ label: 'Dirt scoot · 2×26"', value: '900|6|10' }
		],
		brakeNote: "A heel brake on tiny wheels can only do so much — past this grade you'll be running it out or bailing. Walk it."
	}
};

export const MODE_ICONS: Record<string, string> = {
	eskate: '<svg viewBox="0 0 24 24"><path d="M2 16.5h18.5v2H2zM6 18.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zm12 0a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM13 2l-2.2 9.5H4.5L6 14h6l2.4-9.5z"/></svg>',
	ebike: '<svg viewBox="0 0 24 24"><path d="M5.5 17.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm13 0a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM5 10h4l2.5 6H9.8L8 12H6v9H4v-9c0-1.1.9-2 2-2zm11-4h-3v2h3v4l5 7v-2.4l-3.7-5.1V8H18V6z"/></svg>',
	scooter: '<svg viewBox="0 0 24 24"><path d="M12 2v8.5L6.5 20H4l6-9.5V4H8V2h4zm3 0v2h4.5l2 6H19l-1.6-4.5H15V14h6v-2.3l2.3 5.3H4v2h20v-2h-2.6L19 10V4h-4V2h-3zM7 20a2 2 0 100 4 2 2 0 000-4z"/></svg>',
	euc: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 100 18 9 9 0 000-18zm0 3a6 6 0 110 12 6 6 0 010-12zm0 3a3 3 0 100 6 3 3 0 000-6z"/></svg>',
	push: '<svg viewBox="0 0 24 24"><path d="M2 15.5h18v2H2zM5 17.5a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zm14 0a1.8 1.8 0 100 3.6 1.8 1.8 0 000-3.6zM12 2c-1 3.5-2.5 6-4.5 8.5l1.7 1.5C10.7 10.2 11.8 8 12.6 5l3.9 7H19l-4.5-8.5c-.8-1-1.7-1.5-2.5-1.5z"/></svg>',
	bike: '<svg viewBox="0 0 24 24"><path d="M5.5 16.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7zm13 0a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM12 4a1 1 0 011 1v3.6l3.5 5.9h-2.2L11.5 10H8.7l1.9 4.5H8.4L5.5 9.6 7.2 8.4l1.6 2.7 1-2.7V5a1 1 0 011-1h1.2zM14.5 2v2H17v2h-2.5v2h-2V6H10V4h2.5V2h2z"/></svg>',
	kick: '<svg viewBox="0 0 24 24"><path d="M13 2v3h5l3 9h-2.1l-2.4-7H13v13h4v2H5v-2h6V4H8V2h5zm-6 16a2 2 0 100 4 2 2 0 000-4zm12 0a2 2 0 100 4 2 2 0 000-4z"/></svg>'
};
