/* eslint-disable no-console */
import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEED_FILE = join(__dirname, '..', 'db', 'seeds', '001_reference_data.sql');

async function seed() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL is required');
		process.exit(1);
	}
	const pool = new Pool({ connectionString: databaseUrl });
	try {
		const sql = readFileSync(SEED_FILE, 'utf-8');
		await pool.query(sql);
		console.log('Seed data applied.');
	} finally {
		await pool.end();
	}
}

seed();
