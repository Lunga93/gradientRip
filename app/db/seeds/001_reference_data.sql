-- Seed: reference transport modes and board presets
-- This data is hand-validated and must match the frontend exactly.
-- Run with: npm run db:seed

INSERT INTO transport_modes (id, label, tag, "group", unit, human, climb_note, brake_note, phys) VALUES
(
    'eskate',
    'E-skate',
    'Boards that grind uphill, brakes that fear downhill',
    'electric',
    'board',
    false,
    'Expect the motors to labour, speed to drop sharply, and range to run worse than estimated on that stretch.',
    'That''s a braking problem, not an effort problem — worst right after a full charge, when electronic braking is weakest. Don''t ride this leg unless you know it and can footbrake it.',
    '{"cda": 0.65, "crr": 0.02, "eff": 0.8, "usable": 0.87, "speed": 22, "vehicleKg": 6.8}'::jsonb
),
(
    'ebike',
    'E-bike',
    'Gears climb, hydraulic discs stop',
    'electric',
    'bike',
    false,
    'Expect to drop to the granny gear and grind — speed will fall off and the battery will drain faster than estimated there.',
    'That''s past what this bike''s brakes can hold comfortably on a sustained descent — walk it, reroute, or expect serious brake fade.',
    '{"cda": 0.95, "crr": 0.008, "eff": 0.85, "usable": 0.9, "speed": 25, "vehicleKg": 22}'::jsonb
),
(
    'scooter',
    'E-scooter',
    'Small wheels, short braking margin',
    'electric',
    'scooter',
    false,
    'Expect the motors to bog down and speed to collapse on that pitch — small wheels stall fast on steep grades.',
    'Small wheels and short wheelbase make steep descents sketchy fast — past this limit the scooter can out-brake its own stability. Reroute.',
    '{"cda": 0.8, "crr": 0.012, "eff": 0.82, "usable": 0.88, "speed": 22, "vehicleKg": 14}'::jsonb
),
(
    'euc',
    'EUC / Onewheel',
    'Climbs anything, nosedives downhill',
    'electric',
    'wheel',
    false,
    'Expect tilt-back and beeping alarms on that pitch — the wheel will be at its torque limit.',
    'Self-balancing wheels climb hard but overspeed downhill — past this grade you risk pedal tilt-back or cutout. Do not ride it.',
    '{"cda": 0.7, "crr": 0.015, "eff": 0.85, "usable": 0.88, "speed": 20, "vehicleKg": 12}'::jsonb
),
(
    'push',
    'Push skate',
    'Your legs are the motor, your shoe is the brake',
    'human',
    'board',
    true,
    'You won''t be pushing up that — expect to walk the board up on foot.',
    'Footbraking has a hard limit — past this grade expect the shoe to smoke and the speed to keep building. Walk it.',
    '{"cda": 0.65, "crr": 0.02, "eff": 0.24, "usable": 1.0, "speed": 12, "vehicleKg": 4}'::jsonb
),
(
    'bike',
    'Pedal bike',
    'Gears, lungs and lunch',
    'human',
    'bike',
    true,
    'Expect to be out of the saddle — or off it, pushing — on that pitch.',
    'Past this grade even good rim or disc brakes cook on a long descent — plan stops to let them cool or reroute.',
    '{"cda": 0.95, "crr": 0.006, "eff": 0.24, "usable": 1.0, "speed": 20, "vehicleKg": 12}'::jsonb
),
(
    'kick',
    'Kick scooter',
    'Kick, coast, repeat',
    'human',
    'scooter',
    true,
    'You won''t be scooting up that — expect to walk it.',
    'A heel brake on tiny wheels can only do so much — past this grade you''ll be running it out or bailing. Walk it.',
    '{"cda": 0.8, "crr": 0.01, "eff": 0.24, "usable": 1.0, "speed": 12, "vehicleKg": 5}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Board presets: value format is "capWh|climbLimit|brakeLimit"
INSERT INTO boards (mode_id, label, value) VALUES
-- eskate
('eskate', 'Journ-E Phantom · 336 Wh', '336|30|12'),
('eskate', 'Budget single-motor · 200 Wh', '200|20|10'),
('eskate', 'Off-road dual-motor · 450 Wh', '450|35|15'),
-- ebike
('ebike', 'City commuter · 500 Wh', '500|25|22'),
('ebike', 'Cargo longtail · 750 Wh', '750|22|20'),
('ebike', 'Ultralight road · 360 Wh', '360|28|25'),
-- scooter
('scooter', 'Commuter · 350 Wh', '350|18|12'),
('scooter', 'Dual-motor · 600 Wh', '600|25|15'),
('scooter', 'Lightweight · 250 Wh', '250|15|10'),
-- euc
('euc', 'Onewheel-class · 500 Wh', '500|25|10'),
('euc', 'EUC mid · 1000 Wh', '1000|30|12'),
('euc', 'EUC long-range · 1500 Wh', '1500|30|12'),
-- push
('push', 'Longboard 38" · push', '1200|8|12'),
('push', 'Double-drop LDP · push', '1200|7|12'),
('push', 'Cruiser 30" · push', '1200|6|10'),
-- bike
('bike', 'Road bike · 2x12', '1500|25|25'),
('bike', 'Hardtail MTB · 1x12', '1500|30|30'),
('bike', 'City 3-speed · coaster', '1500|15|20'),
-- kick
('kick', 'Adult big-wheel · 200 mm', '900|7|10'),
('kick', 'Standard · 145 mm', '900|5|8'),
('kick', 'Dirt scoot · 2x26"', '900|6|10')
ON CONFLICT (mode_id, value) DO NOTHING;
