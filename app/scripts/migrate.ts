/* eslint-disable no-console */
import { Pool } from 'pg';
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, '..', 'db', 'migrations');

function getMigrations() {
	const files = readdirSync(MIGRATIONS_DIR)
		.filter((f) => f.endsWith('.up.sql'))
		.sort();
	return files.map((f) => ({
		version: f.replace('.up.sql', ''),
		up: readFileSync(join(MIGRATIONS_DIR, f), 'utf-8'),
		down: readFileSync(join(MIGRATIONS_DIR, f.replace('.up.sql', '.down.sql')), 'utf-8')
	}));
}

async function appliedVersions(pool: Pool) {
	const { rows } = await pool.query('SELECT version FROM schema_migrations ORDER BY version');
	return new Set(rows.map((r) => r.version));
}

async function migrateUp() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL is required');
		process.exit(1);
	}
	const pool = new Pool({ connectionString: databaseUrl });
	try {
		await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
		const applied = await appliedVersions(pool);
		const migrations = getMigrations();
		let count = 0;
		for (const migration of migrations) {
			if (applied.has(migration.version)) continue;
			console.log(`Applying ${migration.version}...`);
			await pool.query('BEGIN');
			try {
				await pool.query(migration.up);
				await pool.query('INSERT INTO schema_migrations (version) VALUES ($1)', [migration.version]);
				await pool.query('COMMIT');
				count++;
			} catch (err) {
				await pool.query('ROLLBACK');
				throw err;
			}
		}
		console.log(`Applied ${count} migration(s).`);
	} finally {
		await pool.end();
	}
}

async function migrateDown() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL is required');
		process.exit(1);
	}
	const pool = new Pool({ connectionString: databaseUrl });
	try {
		const applied = await appliedVersions(pool);
		const migrations = getMigrations().reverse();
		for (const migration of migrations) {
			if (!applied.has(migration.version)) continue;
			console.log(`Rolling back ${migration.version}...`);
			await pool.query('BEGIN');
			try {
				await pool.query(migration.down);
				await pool.query('DELETE FROM schema_migrations WHERE version = $1', [migration.version]);
				await pool.query('COMMIT');
				break;
			} catch (err) {
				await pool.query('ROLLBACK');
				throw err;
			}
		}
		console.log('Rollback complete.');
	} finally {
		await pool.end();
	}
}

const command = process.argv[2] || 'up';
if (command === 'up') migrateUp();
else if (command === 'down') migrateDown();
else {
	console.error(`Unknown command: ${command}. Use "up" or "down".`);
	process.exit(1);
}
