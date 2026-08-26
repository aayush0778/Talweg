import fs from 'fs';
import path from 'path';
import { pool } from './index';

/**
 * Simple SQL migration runner.
 *
 * HOW IT WORKS:
 * 1. Creates a _migrations tracking table if it doesn't exist.
 * 2. Reads all .sql files from server/migrations/ sorted alphabetically.
 * 3. Skips files already recorded in _migrations.
 * 4. Applies pending migrations inside transactions.
 * 5. Records each successful migration.
 *
 * WHY NOT an ORM or migration library:
 * - We want to write raw SQL with PostGIS types (geometry, spatial indexes).
 * - A custom runner is ~50 lines, fully understandable, and any team member can explain it.
 * - No learning curve for a library nobody on the team has used.
 */
async function migrate(): Promise<void> {
  const client = await pool.connect();
  console.log('[migrate] Connected to database');

  try {
    // Ensure the tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id    SERIAL PRIMARY KEY,
        name  VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Determine which migrations have already been applied
    const { rows: applied } = await client.query(
      'SELECT name FROM _migrations ORDER BY name'
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Read migration files from disk
    const migrationsDir = path.join(__dirname, '../../migrations');
    if (!fs.existsSync(migrationsDir)) {
      console.log('[migrate] No migrations directory found — nothing to do');
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('[migrate] No migration files found');
      return;
    }

    let appliedCount = 0;
    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[migrate]   skip: ${file} (already applied)`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file]
        );
        await client.query('COMMIT');
        console.log(`[migrate]   applied: ${file}`);
        appliedCount++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate]   FAILED: ${file}`);
        throw err;
      }
    }

    console.log(
      `[migrate] Done. ${appliedCount} migration(s) applied, ${files.length - appliedCount} skipped.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[migrate] Migration failed:', err);
  process.exit(1);
});
