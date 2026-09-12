import { error, type RequestHandler } from '@sveltejs/kit';
import { withUser } from '$lib/server/db.js';
import { requireUser } from '$lib/server/device.js';

export const DELETE: RequestHandler = async (event) => {
	const userId = await requireUser(event);
	const id = Number(event.params.id);
	if (!Number.isInteger(id)) throw error(400, 'id must be an integer');
	const result = await withUser(userId, async (c) => {
		return c.query('DELETE FROM presets WHERE id = $1 AND user_id = current_user_id()', [id]);
	});
	if (result.rowCount === 0) throw error(404, 'Not found');
	return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
};
