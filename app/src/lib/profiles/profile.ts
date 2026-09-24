const SPORTS = new Set(['eskate', 'ebike', 'scooter', 'euc', 'push', 'bike', 'kick']);

export const parseSports = (v: unknown): string[] => {
	if (!Array.isArray(v)) return [];
	return v.filter((s): s is string => typeof s === 'string' && SPORTS.has(s));
};

export const parseHome = (v: unknown): { lat: number; lon: number; label: string } | null => {
	if (!v || typeof v !== 'object') return null;
	const h = v as Record<string, unknown>;
	if (typeof h.lat !== 'number' || typeof h.lon !== 'number' || typeof h.label !== 'string')
		return null;
	if (!Number.isFinite(h.lat) || !Number.isFinite(h.lon) || !h.label.trim()) return null;
	return { lat: h.lat, lon: h.lon, label: h.label.trim().slice(0, 120) };
};

export const parseUnits = (v: unknown): 'km' => 'km';
