import fs from 'fs';
import path from 'path';
import { pool } from './index';
import { BACKTEST_EVENTS } from '../services/backtestScenarios';
import { REAL_REPLAY_RECORD } from '../services/historicalReplay';

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

    // Seed historical_event_replays
    console.log('[seed] Seeding historical_event_replays...');
    const tableExists = await client.query(
      `SELECT to_regclass('historical_event_replays') as exists`
    );
    if (tableExists.rows[0].exists) {
      await client.query('DELETE FROM historical_event_replays');
      
      // 1. Seed verified real historical replay record (Phase P0 proof)
      await client.query(
        `INSERT INTO historical_event_replays (
          id, event_id, event_date, latitude, longitude, zone_id, source, 
          rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, 
          historical_density, data_quality, data_notes, actual_event
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
        [
          REAL_REPLAY_RECORD.id,
          REAL_REPLAY_RECORD.event_id,
          REAL_REPLAY_RECORD.event_date,
          REAL_REPLAY_RECORD.latitude,
          REAL_REPLAY_RECORD.longitude,
          REAL_REPLAY_RECORD.zone_id,
          REAL_REPLAY_RECORD.source,
          REAL_REPLAY_RECORD.rainfall_24h,
          REAL_REPLAY_RECORD.rainfall_3d,
          REAL_REPLAY_RECORD.rainfall_7d,
          REAL_REPLAY_RECORD.soil_moisture,
          REAL_REPLAY_RECORD.slope,
          REAL_REPLAY_RECORD.historical_density,
          REAL_REPLAY_RECORD.data_quality,
          REAL_REPLAY_RECORD.data_notes,
          REAL_REPLAY_RECORD.actual_event,
        ]
      );

      // 2. Seed synthetic backtest events for methodology baseline
      for (const evt of BACKTEST_EVENTS) {
        // Try to find lat/lng and matching id from events table if seeded
        let lat = 0;
        let lng = 0;
        let matchedEventId: string | null = null;
        try {
          const eventRecord = await client.query('SELECT id, ST_Y(geometry::geometry) as lat, ST_X(geometry::geometry) as lng FROM landslide_events WHERE id = $1', [evt.id]);
          if (eventRecord.rows.length > 0) {
            matchedEventId = eventRecord.rows[0].id;
            lat = eventRecord.rows[0].lat;
            lng = eventRecord.rows[0].lng;
          }
        } catch(e) { }

        await client.query(
          `INSERT INTO historical_event_replays (
            id, event_id, event_date, latitude, longitude, zone_id, source, 
            rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, 
            historical_density, data_quality, data_notes, actual_event
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
          [
            `replay-${evt.id}`, matchedEventId, evt.date, lat, lng, evt.zoneId, 'synthetic_seed',
            evt.input.rainfall_24h, evt.input.rainfall_3d, null, evt.input.soil_moisture,
            evt.input.slope, evt.input.historical_density, 'synthetic_demo', evt.description, true
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Verify counts
    const rCount = await client.query('SELECT COUNT(*) FROM regions');
    const zCount = await client.query('SELECT COUNT(*) FROM risk_zones');
    const eCount = await client.query('SELECT COUNT(*) FROM landslide_events');
    const oCount = await client.query('SELECT COUNT(*) FROM environmental_observations');
    let hCountStr = '0 (table missing)';
    if (tableExists.rows[0].exists) {
      const hCount = await client.query('SELECT COUNT(*) FROM historical_event_replays');
      hCountStr = hCount.rows[0].count;
    }

    console.log('[seed] Done:');
    console.log(`  regions:          ${rCount.rows[0].count}`);
    console.log(`  risk_zones:       ${zCount.rows[0].count}`);
    console.log(`  landslide_events: ${eCount.rows[0].count}`);
    console.log(`  env_observations: ${oCount.rows[0].count}`);
    console.log(`  historical_replays: ${hCountStr}`);
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
