import { describe, it, expect, vi, beforeEach } from 'vitest';
import { session } from './state/session.svelte.js';
import { enterDrawMode, exitDrawMode, undoDrawPoint, addDrawPoint, getDrawnPath } from './tracker.js';
import * as planner from './planner.svelte.js';
import type { LatLon } from './util.js';

vi.mock('./mapController.svelte.js', () => ({
	ensureLeaflet: vi.fn(),
	getMap: vi.fn(),
	ensureMap: vi.fn(),
	redrawDrawLayer: vi.fn(),
	clearDrawLayer: vi.fn(),
	setDrawCursor: vi.fn(),
	redrawRecordLayer: vi.fn(),
	clearRecordLayer: vi.fn(),
	updateTrackMarker: vi.fn(),
	clearTrackMarker: vi.fn(),
	updateRecordMarker: vi.fn(),
	setRouteProgress: vi.fn(),
	clearRouteProgress: vi.fn(),
	showHillBadge: vi.fn(),
	clearHillBadge: vi.fn(),
	showArrivalBadge: vi.fn(),
	clearArrivalBadge: vi.fn()
}));

describe('tracker draw mode', () => {
	beforeEach(() => {
		exitDrawMode();
		vi.restoreAllMocks();
	});

	it('enterDrawMode resets points and legs', () => {
		enterDrawMode();
		expect(session.drawMode).toBe(true);
		expect(session.drawPoints).toEqual([]);
		expect(session.drawLegs).toEqual([]);
	});

	it('addDrawPoint adds points and snaps legs asynchronously', async () => {
		const p1: LatLon = [-33.9, 18.4];
		const p2: LatLon = [-33.91, 18.41];
		const roadLeg: LatLon[] = [p1, [-33.905, 18.405], p2];

		vi.spyOn(planner, 'snapDrawnLeg').mockResolvedValue({
			leg: roadLeg,
			snapped: true
		});

		enterDrawMode();
		addDrawPoint(p1);
		expect(session.drawPoints).toEqual([p1]);
		expect(session.drawLegs).toEqual([]);
		expect(getDrawnPath()).toEqual([p1]);

		addDrawPoint(p2);
		expect(session.drawPoints).toEqual([p1, p2]);
		// Initially provisional straight leg before promise resolves
		expect(getDrawnPath()).toEqual([p1, p2]);

		// Wait for snapDrawnLeg promise to resolve
		await vi.waitFor(() => {
			expect(session.drawLegs[0]).toEqual(roadLeg);
		});

		expect(getDrawnPath()).toEqual(roadLeg);
	});

	it('undoDrawPoint removes the last point and its corresponding leg', async () => {
		const p1: LatLon = [-33.9, 18.4];
		const p2: LatLon = [-33.91, 18.41];
		const p3: LatLon = [-33.92, 18.42];

		vi.spyOn(planner, 'snapDrawnLeg').mockResolvedValue({
			leg: [p1, p2],
			snapped: false
		});

		enterDrawMode();
		addDrawPoint(p1);
		addDrawPoint(p2);
		addDrawPoint(p3);

		expect(session.drawPoints.length).toBe(3);
		expect(session.drawLegs.length).toBe(2);

		undoDrawPoint();
		expect(session.drawPoints.length).toBe(2);
		expect(session.drawLegs.length).toBe(1);

		undoDrawPoint();
		expect(session.drawPoints.length).toBe(1);
		expect(session.drawLegs.length).toBe(0);
	});

	it('exitDrawMode clears draw state', () => {
		enterDrawMode();
		addDrawPoint([-33.9, 18.4]);
		addDrawPoint([-33.91, 18.41]);

		exitDrawMode();
		expect(session.drawMode).toBe(false);
		expect(session.drawPoints).toEqual([]);
		expect(session.drawLegs).toEqual([]);
		expect(getDrawnPath()).toEqual([]);
	});
});
