import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { autocompleteSearch } from '$lib/server/services.js';

export const GET: RequestHandler = async ({ url }) => {
	const q = (url.searchParams.get('q') || '').trim();
	const lat = Number(url.searchParams.get('lat'));
	const lon = Number(url.searchParams.get('lon'));
	const rawCountry = url.searchParams.get('country') || 'za';
	const country = /^[a-z]{2}$/i.test(rawCountry) ? rawCountry.toLowerCase() : 'za';
	const noStore = { headers: { 'cache-control': 'no-store' } };
	try {
		if (!q) return json([], noStore);
		if (q.length > 200) throw new Error('Query too long.');
		const results = await autocompleteSearch(
			q,
			Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : -33.9249,
			Number.isFinite(lon) && Math.abs(lon) <= 180 ? lon : 18.4241,
			country
		);
		return json(results, noStore);
	} catch (err) {
		return json({ error: (err as Error).message || 'Autocomplete lookup failed' }, { status: 400, ...noStore });
	}
};