import { Pool } from 'pg';
import { config } from '../config';

/**
 * Shared connection pool for PostgreSQL.
 * All database access in the application goes through this pool.
 */
export const pool = new Pool({
  connectionString: config.databaseUrl,
});

/**
 * Verify database connectivity and PostGIS availability on startup.
 * Logs connection status — does NOT throw if PostGIS is missing,
 * since the migration might not have run yet.
 */
export async function testConnection(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('[db] PostgreSQL connected');

    try {
      const result = await client.query(
        'SELECT PostGIS_Version() AS version'
      );
      console.log(`[db] PostGIS version: ${result.rows[0].version}`);
    } catch {
      console.log('[db] PostGIS extension not yet enabled (run migrations)');
    }
  } finally {
    client.release();
  }
}
