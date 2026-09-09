// UI/session helpers. Pure route geometry lives in $lib/engine/route-geometry
// and is re-exported here so existing importers keep working.

export type { LatLon } from './engine/index.js';
export { haversine, resample, cumulative, nearestOnLine, RESAMPLE_STEP_M } from './engine/index.js';

const geoCode = (err: GeolocationPositionError): number => (err ? err.code : 0);
export const geoErrorMessage = (err: GeolocationPositionError): string => {
	switch (geoCode(err)) {
		case 1: return 'Location permission denied — allow it for this site in your browser settings and try again.';
		case 2: return "Your device couldn't determine a position (no GPS/Wi-Fi fix available).";
		case 3: return 'Location request timed out — try again, ideally with a clearer view of the sky or on Wi-Fi.';
		default: return 'Could not get your location.';
	}
};
