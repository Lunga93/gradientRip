// Basemap tile catalog — every map look the app can wear. All entries are
// plain Leaflet raster XYZ layers (no new dependencies). CARTO + OSM are
// keyless; Stadia works keyless on localhost and needs domain auth/API key
// in production (free tier: 200k tiles/month).

export interface MapStyleDef {
	id: string;
	name: string;
	blurb: string;
	url: string;
	subdomains?: string;
	maxZoom: number;
	attribution: string;
	/** native dark artwork — never gets the invert filter */
	dark: boolean;
	/** only true for plain OSM: legible when inverted under a dark theme */
	invertInDark?: boolean;
	group: 'light' | 'dark';
}

const OSM_ATTR =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const CARTO_ATTR =
	'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const STADIA_ATTR =
	'&copy; <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://stamen.com/" target="_blank">Stamen Design</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

export const MAP_STYLES: MapStyleDef[] = [
	{
		id: 'voyager',
		name: 'Voyager',
		blurb: 'Warm, colourful streets',
		url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
		subdomains: 'abcd',
		maxZoom: 20,
		attribution: CARTO_ATTR,
		dark: false,
		group: 'light'
	},
	{
		id: 'positron',
		name: 'Positron',
		blurb: 'Soft grey minimal',
		url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
		subdomains: 'abcd',
		maxZoom: 20,
		attribution: CARTO_ATTR,
		dark: false,
		group: 'light'
	},
	{
		id: 'watercolor',
		name: 'Watercolor',
		blurb: 'Hand-painted fun',
		url: 'https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}{r}.jpg',
		maxZoom: 16,
		attribution: STADIA_ATTR,
		dark: false,
		group: 'light'
	},
	{
		id: 'toner-lite',
		name: 'Toner Lite',
		blurb: 'Crisp black & white',
		url: 'https://tiles.stadiamaps.com/tiles/stamen_toner_lite/{z}/{x}/{y}{r}.png',
		maxZoom: 20,
		attribution: STADIA_ATTR,
		dark: false,
		group: 'light'
	},
	{
		id: 'terrain',
		name: 'Terrain',
		blurb: 'Hills + trails outdoors',
		url: 'https://tiles.stadiamaps.com/tiles/stamen_terrain/{z}/{x}/{y}{r}.png',
		maxZoom: 18,
		attribution: STADIA_ATTR,
		dark: false,
		group: 'light'
	},
	{
		id: 'osm',
		name: 'Standard',
		blurb: 'Classic OpenStreetMap',
		url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
		maxZoom: 19,
		attribution: OSM_ATTR,
		dark: false,
		invertInDark: true,
		group: 'light'
	},
	{
		id: 'darkmatter',
		name: 'Dark Matter',
		blurb: 'Charcoal, muted colour',
		url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
		subdomains: 'abcd',
		maxZoom: 20,
		attribution: CARTO_ATTR,
		dark: true,
		group: 'dark'
	},
	{
		id: 'alidade-dark',
		name: 'Alidade Dark',
		blurb: 'Deep navy night ride',
		url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
		maxZoom: 20,
		attribution: STADIA_ATTR,
		dark: true,
		group: 'dark'
	}
];

export const DEFAULT_LIGHT_STYLE = 'voyager';
export const DEFAULT_DARK_STYLE = 'darkmatter';

export const styleById = (id: string): MapStyleDef | undefined =>
	MAP_STYLES.find((s) => s.id === id);

export const isValidStyleId = (id: string): boolean => styleById(id) !== undefined;

export const defaultStyleForTheme = (theme: 'light' | 'dark'): string =>
	theme === 'dark' ? DEFAULT_DARK_STYLE : DEFAULT_LIGHT_STYLE;
