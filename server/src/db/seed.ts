import fs from 'fs';
import path from 'path';
import { pool } from './index';

/**
 * Seed runner — loads server/seeds/seed.sql into the database.
 *
 * Clears existing data in reverse-dependency order before seeding
 * so the script is idempotent (safe to run multiple times).
 */
async function seed(): Promise<void> {
  const client = await pool.connect();
  console.log('[seed] Connected to database');

  try {
    const seedFile = path.join(__dirname, '../../seeds/seed.sql');
    if (!fs.existsSync(seedFile)) {
      console.error('[seed] No seed file found at', seedFile);
      process.exit(1);
    }

    const sql = fs.readFileSync(seedFile, 'utf-8');

    await client.query('BEGIN');

    // Clear existing seed data in dependency order
    console.log('[seed] Clearing existing data...');
    await client.query('DELETE FROM alerts');
    await client.query('DELETE FROM environmental_observations');
    await client.query('DELETE FROM landslide_events');
    await client.query('DELETE FROM risk_zones');
    await client.query('DELETE FROM regions');

    // Run the seed SQL
    console.log('[seed] Inserting seed data...');
    await client.query(sql);

    await client.query('COMMIT');

    // Verify counts
    const rCount = await client.query('SELECT COUNT(*) FROM regions');
    const zCount = await client.query('SELECT COUNT(*) FROM risk_zones');
    const eCount = await client.query('SELECT COUNT(*) FROM landslide_events');
    const oCount = await client.query('SELECT COUNT(*) FROM environmental_observations');

    console.log('[seed] Done:');
    console.log(`  regions:          ${rCount.rows[0].count}`);
    console.log(`  risk_zones:       ${zCount.rows[0].count}`);
    console.log(`  landslide_events: ${eCount.rows[0].count}`);
    console.log(`  env_observations: ${oCount.rows[0].count}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[seed] Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
