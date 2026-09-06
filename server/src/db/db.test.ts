import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from './index';

// ============================================================
// Database & PostGIS Integration Tests
// ============================================================
// Run: npm test  (from server/)
// Verifies PostGIS extension, migrations, and seeded data.
// ============================================================

describe('Database & PostGIS Integration', () => {
  before(async () => {
    // Quick probe to ensure DB is accessible
    const res = await pool.query('SELECT 1 AS ok');
    assert.equal(res.rows[0].ok, 1);
  });

  after(async () => {
    // We don't close pool here so other tests or runner can finish cleanly
  });

  it('verifies PostGIS extension is installed and active', async () => {
    const res = await pool.query('SELECT PostGIS_Version() AS version');
    assert.ok(res.rows.length > 0);
    assert.ok(typeof res.rows[0].version === 'string');
    assert.ok(res.rows[0].version.includes('3.'), `Expected PostGIS 3.x, got ${res.rows[0].version}`);
  });

  it('retrieves the Sikkim region with valid GeoJSON geometry', async () => {
    const res = await pool.query(`
      SELECT id, name, state, ST_AsGeoJSON(geometry)::json AS geojson
      FROM regions
      WHERE id = 'sikkim'
    `);
    assert.equal(res.rows.length, 1);
    const sikkim = res.rows[0];
    assert.equal(sikkim.name, 'Sikkim');
    assert.equal(sikkim.state, 'Sikkim');
    assert.equal(sikkim.geojson.type, 'Polygon');
    assert.ok(Array.isArray(sikkim.geojson.coordinates[0]));
  });

  it('retrieves all 6 seeded risk zones with base slope and geometry', async () => {
    const res = await pool.query(`
      SELECT id, region_id, name, base_slope, ST_AsGeoJSON(geometry)::json AS geojson
      FROM risk_zones
      ORDER BY id
    `);
    assert.equal(res.rows.length, 6);

    const zoneIds = res.rows.map((r) => r.id);
    assert.deepEqual(zoneIds.sort(), ['gangtok', 'gyalshing', 'mangan', 'namchi', 'pakyong', 'soreng'].sort());

    for (const zone of res.rows) {
      assert.equal(zone.region_id, 'sikkim');
      assert.ok(zone.base_slope > 0, `Base slope for ${zone.id} should be > 0`);
      assert.equal(zone.geojson.type, 'Polygon');
    }
  });

  it('retrieves historical landslide events with spatial points and provenance', async () => {
    const res = await pool.query(`
      SELECT id, date, latitude, longitude, trigger, category, source,
             ST_AsGeoJSON(geometry)::json AS geojson
      FROM landslide_events
    `);
    assert.ok(res.rows.length >= 15);

    for (const evt of res.rows) {
      assert.ok(evt.id.startsWith('evt-') || evt.id.startsWith('glc-'));
      assert.ok(evt.latitude >= 27.0 && evt.latitude <= 28.5, `Lat ${evt.latitude} within Sikkim bounds`);
      assert.ok(evt.longitude >= 88.0 && evt.longitude <= 89.0, `Lon ${evt.longitude} within Sikkim bounds`);
      assert.equal(evt.geojson.type, 'Point');
      assert.ok(evt.source === 'synthetic_seed' || evt.source.includes('NASA') || evt.source === 'nasa_glc');
    }
  });

  it('retrieves current environmental observations for all zones', async () => {
    const res = await pool.query(`
      SELECT zone_id, rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, source
      FROM environmental_observations
      ORDER BY zone_id
    `);
    assert.equal(res.rows.length, 6);

    for (const obs of res.rows) {
      assert.ok(obs.rainfall_24h >= 0);
      assert.ok(obs.rainfall_3d >= obs.rainfall_24h);
      assert.ok(obs.soil_moisture >= 0 && obs.soil_moisture <= 1.0);
      assert.ok(obs.slope >= 15 && obs.slope <= 60);
      assert.equal(obs.source, 'chirps_imd');
    }
  });

  it('supports spatial point-in-polygon query using PostGIS ST_Contains', async () => {
    // Test that Gangtok event (evt-001 at 27.33 N, 88.61 E) falls within Gangtok zone polygon
    const res = await pool.query(`
      SELECT e.id AS event_id, z.id AS zone_id, z.name AS zone_name
      FROM landslide_events e
      JOIN risk_zones z ON ST_Contains(z.geometry, e.geometry)
      WHERE e.id = 'evt-001'
    `);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].zone_id, 'gangtok');
  });
});
