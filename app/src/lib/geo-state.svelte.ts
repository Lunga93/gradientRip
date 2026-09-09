import type { LatLon } from '$lib/engine';
import { loadKnownLocation } from './storage.js';

export const DEFAULT_CENTER: LatLon = [-33.9249, 18.4241];
export const DEFAULT_COUNTRY = 'za';

const remembered = typeof localStorage !== 'undefined' ? loadKnownLocation() : null;

class GeoState {
	center = $state<LatLon>(remembered ? [remembered.lat, remembered.lon] : DEFAULT_CENTER);
	country = $state<string>(DEFAULT_COUNTRY);

	setCenter(center: LatLon): void {
		this.center = center;
	}

	setCountry(code: string): void {
		this.country = code;
	}
}

export const geoState = new GeoState();
