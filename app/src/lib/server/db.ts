import { Pool, type PoolClient } from 'pg';

let pool: Pool | null = null;

export function getPool(): Pool {
	if (!pool) {
		const connectionString = process.env.DATABASE_URL;
		if (!connectionString) {
			throw new Error('DATABASE_URL is not set');
		}
		pool = new Pool({
			connectionString,
			max: 10,
			idleTimeoutMillis: 30000,
			connectionTimeoutMillis: 5000
		});
	}
	return pool;
}

export async function withUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
	const client = await getPool().connect();
	try {
		await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
		return await fn(client);
	} finally {
		client.release();
	}
}

export async function resolveUser(deviceId: string): Promise<string> {
	const p = getPool();
	const { rows } = await p.query(
		`INSERT INTO users (device_id) VALUES ($1)
		 ON CONFLICT (device_id) DO UPDATE SET device_id = EXCLUDED.device_id
		 RETURNING id`,
		[deviceId]
	);
	return rows[0].id;
}
