import { Pool, type PoolClient } from 'pg';
import { env } from '$env/dynamic/private';

let pool: Pool | null = null;

export function getPool(): Pool {
	if (!pool) {
		const connectionString = env.DATABASE_URL || process.env.DATABASE_URL;
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
		// set_config's transaction-local flag only holds inside an explicit
		// transaction — without BEGIN, each following statement runs in its own
		// implicit transaction and current_user_id() would read NULL.
		await client.query('BEGIN');
		await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
		const result = await fn(client);
		await client.query('COMMIT');
		return result;
	} catch (err) {
		await client.query('ROLLBACK').catch(() => {});
		throw err;
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
