
import type { PoolClient } from 'pg';

export const canonicalPair = (a: string, b: string): [string, string] =>
	a < b ? [a, b] : [b, a];

export const normalizeEmail = (v: unknown): string | null => {
	if (typeof v !== 'string') return null;
	const email = v.trim().toLowerCase();
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

export interface FriendRow {
	id: string;
	display_name: string | null;
	avatar_url: string | null;
	email: string | null;
	lat: number | null;
	lon: number | null;
	speed: number | null;
	live_at: string | null;
}

export interface PendingRow {
	id: string;
	display_name: string | null;
	avatar_url: string | null;
	created_at: string;
}

export const listFriends = async (c: PoolClient): Promise<FriendRow[]> => {
	const { rows } = await c.query(
		`SELECT u.id, u.display_name, u.avatar_url, u.email,
		        lp.lat, lp.lon, lp.speed, lp.updated_at AS live_at
		 FROM friendships f
		 JOIN users u ON u.id = CASE WHEN f.user_a = current_user_id() THEN f.user_b ELSE f.user_a END
		 LEFT JOIN live_positions lp ON lp.user_id = u.id
		 WHERE (f.user_a = current_user_id() OR f.user_b = current_user_id())
		   AND f.status = 'accepted'
		 ORDER BY u.display_name NULLS LAST`
	);
	return rows as FriendRow[];
};

export const listPending = async (c: PoolClient, incoming: boolean): Promise<PendingRow[]> => {
	const { rows } = await c.query(
		`SELECT u.id, u.display_name, u.avatar_url, f.created_at
		 FROM friendships f
		 JOIN users u ON u.id = ${incoming ? 'f.requested_by' : 'CASE WHEN f.user_a = current_user_id() THEN f.user_b ELSE f.user_a END'}
		 WHERE (f.user_a = current_user_id() OR f.user_b = current_user_id())
		   AND f.status = 'pending'
		   AND f.requested_by ${incoming ? '<>' : '='} current_user_id()
		 ORDER BY f.created_at DESC`
	);
	return rows as PendingRow[];
};
