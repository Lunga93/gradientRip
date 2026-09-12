import { json, type RequestHandler } from '@sveltejs/kit';
import { getPool } from '$lib/server/db.js';

export const GET: RequestHandler = async () => {
	const { rows } = await getPool().query('SELECT id, label, tag, "group", unit, human, climb_note, brake_note, phys FROM transport_modes ORDER BY id');
	return json(rows, {
		headers: { 'Cache-Control': 'no-store' }
	});
};
