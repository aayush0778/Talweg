/**
 * Final Upgrade Seeder — populates the Phase 2/3 data-foundation tables:
 *   - data_sources registry (canonical source catalog)
 *   - rainfall_observations (daily series per zone → rolling windows + ARI)
 *   - soil_observations (soil feature family)
 *   - terrain_features (terrain family beyond slope)
 *
 * HONESTY RULES:
 * - The daily rainfall series, soil values and terrain values are clearly
 *   labeled SYNTHETIC demonstration data (source_id 'seed-telemetry').
 * - They are representative monsoon-condition estimates for the demo, NOT
 *   real telemetry. Real anchors remain the CHIRPS/IMD-backed replay records.
 *
 * Idempotent: clears and re-inserts its own rows; safe to run repeatedly.
 */

import { PoolClient } from 'pg';

const ZONE_SEED_DATA: Record<
  string,
  {
    dailyRainfall: number[]; // 10 days, oldest first (index 9 = most recent)
    soil: {
      soil_type: string;
      soil_texture: string;
      soil_depth_m: number;
      sand: number;
      silt: number;
      clay: number;
      bulk_density: number;
      ksat_mm_h: number;
      awc_mm: number;
      organic_carbon: number;
    };
    terrain: {
      elevation_m: number;
      aspect_deg: number;
      curvature: number;
      ruggedness: number;
      relief_m: number;
      drainage_proximity_m: number;
      road_cut_proximity_m: number;
    };
  }
> = {
  gangtok: {
    dailyRainfall: [18, 42, 65, 30, 12, 88, 24, 56, 74, 95],
    soil: { soil_type: 'Clay loam', soil_texture: 'Clay loam', soil_depth_m: 1.2, sand: 0.32, silt: 0.36, clay: 0.32, bulk_density: 1.42, ksat_mm_h: 6.5, awc_mm: 140, organic_carbon: 2.1 },
    terrain: { elevation_m: 1650, aspect_deg: 215, curvature: -0.012, ruggedness: 28.4, relief_m: 420, drainage_proximity_m: 180, road_cut_proximity_m: 45 },
  },
  mangan: {
    dailyRainfall: [26, 55, 40, 78, 120, 64, 38, 92, 110, 86],
    soil: { soil_type: 'Sandy clay loam', soil_texture: 'Sandy clay loam', soil_depth_m: 0.9, sand: 0.48, silt: 0.27, clay: 0.25, bulk_density: 1.51, ksat_mm_h: 11.0, awc_mm: 105, organic_carbon: 1.7 },
    terrain: { elevation_m: 1420, aspect_deg: 168, curvature: -0.021, ruggedness: 41.2, relief_m: 610, drainage_proximity_m: 90, road_cut_proximity_m: 25 },
  },
  namchi: {
    dailyRainfall: [12, 30, 48, 22, 60, 45, 70, 38, 52, 68],
    soil: { soil_type: 'Silty clay loam', soil_texture: 'Silty clay loam', soil_depth_m: 1.5, sand: 0.18, silt: 0.44, clay: 0.38, bulk_density: 1.38, ksat_mm_h: 4.2, awc_mm: 165, organic_carbon: 2.4 },
    terrain: { elevation_m: 1370, aspect_deg: 240, curvature: -0.008, ruggedness: 22.7, relief_m: 350, drainage_proximity_m: 240, road_cut_proximity_m: 60 },
  },
  pakyong: {
    dailyRainfall: [20, 36, 58, 44, 28, 72, 90, 46, 66, 82],
    soil: { soil_type: 'Clay loam', soil_texture: 'Clay loam', soil_depth_m: 1.1, sand: 0.30, silt: 0.38, clay: 0.32, bulk_density: 1.44, ksat_mm_h: 6.0, awc_mm: 145, organic_carbon: 2.0 },
    terrain: { elevation_m: 1520, aspect_deg: 190, curvature: -0.015, ruggedness: 31.5, relief_m: 480, drainage_proximity_m: 150, road_cut_proximity_m: 35 },
  },
  gyalshing: {
    dailyRainfall: [10, 24, 38, 52, 18, 42, 64, 30, 48, 58],
    soil: { soil_type: 'Loam', soil_texture: 'Loam', soil_depth_m: 1.4, sand: 0.40, silt: 0.35, clay: 0.25, bulk_density: 1.40, ksat_mm_h: 12.5, awc_mm: 130, organic_carbon: 1.9 },
    terrain: { elevation_m: 1210, aspect_deg: 205, curvature: -0.006, ruggedness: 19.8, relief_m: 290, drainage_proximity_m: 310, road_cut_proximity_m: 80 },
  },
  soreng: {
    dailyRainfall: [16, 34, 50, 28, 66, 84, 40, 58, 76, 62],
    soil: { soil_type: 'Sandy loam', soil_texture: 'Sandy loam', soil_depth_m: 1.0, sand: 0.55, silt: 0.25, clay: 0.20, bulk_density: 1.55, ksat_mm_h: 18.0, awc_mm: 95, organic_carbon: 1.5 },
    terrain: { elevation_m: 1180, aspect_deg: 178, curvature: -0.009, ruggedness: 25.6, relief_m: 380, drainage_proximity_m: 200, road_cut_proximity_m: 55 },
  },
};

const DATA_SOURCES: {
  id: string; name: string; type: string; provider: string; license: string;
  update_frequency: string; spatial_resolution: string; temporal_resolution: string;
  latency: string; status: string; citation: string; usage_note: string; coverage: string;
}[] = [
  {
    id: 'chirps', name: 'CHIRPS Satellite Precipitation', type: 'satellite_precipitation',
    provider: 'UCSB Climate Hazards Center / NASA SERVIR', license: 'Open (CHIRPS)',
    update_frequency: 'daily (product); per-event ingestion',
    spatial_resolution: '~5 km (0.05°)', temporal_resolution: 'daily', latency: 'static (ingested)',
    status: 'historical', citation: 'Funk et al., 2015 — CHIRPS',
    usage_note: 'Daily rainfall observations for verified historical replay anchors', coverage: 'Sikkim event windows',
  },
  {
    id: 'sikkim-threshold', name: 'Sikkim Regional Rainfall Threshold', type: 'derived_threshold',
    provider: 'Published regional intensity–duration study', license: 'citation-only',
    update_frequency: 'static (published relationship)', spatial_resolution: 'regional',
    temporal_resolution: 'duration-based (D=1/3/5/7 days)', latency: 'n/a', status: 'derived',
    citation: 'I = 43.26 × D^-0.78 (mm/day)',
    usage_note: 'Deterministic rainfall safety engine', coverage: 'Sikkim Himalaya',
  },
  {
    id: 'seed-telemetry', name: 'In-zone Environmental Observations (demo)', type: 'in_situ_sensors',
    provider: 'TALWEG seed dataset', license: 'n/a (demo data)',
    update_frequency: 'per seed run', spatial_resolution: 'zone centroid',
    temporal_resolution: 'snapshot + daily demo series', latency: 'n/a', status: 'synthetic',
    citation: 'TALWEG synthetic seed (representative monsoon conditions)',
    usage_note: 'Zone rainfall / soil-moisture telemetry used by predictions', coverage: '6 Sikkim risk zones',
  },
];

export async function seedFinalUpgrade(client: PoolClient): Promise<void> {
  // ----- Data sources registry (upsert) -----
  for (const s of DATA_SOURCES) {
    await client.query(
      `INSERT INTO data_sources
         (id, name, type, provider, license, update_frequency, spatial_resolution,
          temporal_resolution, latency, status, citation, usage_note, coverage, last_ingest_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13, NOW())
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         provider = EXCLUDED.provider,
         license = EXCLUDED.license,
         update_frequency = EXCLUDED.update_frequency,
         spatial_resolution = EXCLUDED.spatial_resolution,
         temporal_resolution = EXCLUDED.temporal_resolution,
         latency = EXCLUDED.latency,
         status = EXCLUDED.status,
         citation = EXCLUDED.citation,
         usage_note = EXCLUDED.usage_note,
         coverage = EXCLUDED.coverage,
         last_ingest_at = NOW();`,
      [s.id, s.name, s.type, s.provider, s.license, s.update_frequency, s.spatial_resolution,
       s.temporal_resolution, s.latency, s.status, s.citation, s.usage_note, s.coverage]
    );
  }

  const zoneIds = Object.keys(ZONE_SEED_DATA);
  const existingZones = await client.query<{ id: string }>(`SELECT id FROM risk_zones;`);
  const known = new Set(existingZones.rows.map((r) => r.id));

  // ----- Rainfall daily series (SYNTHETIC demo, clearly labeled) -----
  await client.query(`DELETE FROM rainfall_observations WHERE source_id = 'seed-telemetry';`);
  for (const zoneId of zoneIds) {
    if (!known.has(zoneId)) continue;
    const days = ZONE_SEED_DATA[zoneId].dailyRainfall;
    const now = Date.now();
    for (let i = 0; i < days.length; i++) {
      const observedAt = new Date(now - (days.length - 1 - i) * 86_400_000);
      await client.query(
        `INSERT INTO rainfall_observations (zone_id, observed_at, precip_mm, source_id, provenance)
         VALUES ($1, $2, $3, 'seed-telemetry', 'SYNTHETIC');`,
        [zoneId, observedAt.toISOString(), days[i]]
      );
    }
  }

  // ----- Soil observations (SYNTHETIC demo values, PARTIAL quality) -----
  await client.query(`DELETE FROM soil_observations WHERE source_id = 'seed-telemetry';`);
  for (const zoneId of zoneIds) {
    if (!known.has(zoneId)) continue;
    const s = ZONE_SEED_DATA[zoneId].soil;
    await client.query(
      `INSERT INTO soil_observations
         (zone_id, soil_type, soil_texture, soil_depth_m, sand_fraction, silt_fraction,
          clay_fraction, bulk_density_g_cm3, hydraulic_conductivity_mm_h,
          available_water_capacity_mm, organic_carbon_percent, source_id, provenance,
          quality_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'seed-telemetry','SYNTHETIC','PARTIAL',$12);`,
      [zoneId, s.soil_type, s.soil_texture, s.soil_depth_m, s.sand, s.silt, s.clay,
       s.bulk_density, s.ksat_mm_h, s.awc_mm, s.organic_carbon,
       'Representative demonstration values pending ingestion of SoilGrids/field data. NOT measured values.']
    );
  }

  // ----- Terrain features (SYNTHETIC demo values; slope mirrors zone base_slope) -----
  await client.query(`DELETE FROM terrain_features WHERE source_id = 'seed-telemetry';`);
  for (const zoneId of zoneIds) {
    if (!known.has(zoneId)) continue;
    const t = ZONE_SEED_DATA[zoneId].terrain;
    await client.query(
      `INSERT INTO terrain_features
         (zone_id, elevation_m, slope_deg, aspect_deg, curvature, terrain_ruggedness,
          relative_relief_m, drainage_proximity_m, road_cut_proximity_m, source_id,
          provenance, dem_reference)
       SELECT z.id, $2, COALESCE(z.base_slope, 20.0), $3, $4, $5, $6, $7, $8,
              'seed-telemetry', 'SYNTHETIC', $9
       FROM risk_zones z WHERE z.id = $1;`,
      [zoneId, t.elevation_m, t.aspect_deg, t.curvature, t.ruggedness, t.relief_m,
       t.drainage_proximity_m, t.road_cut_proximity_m,
       'Representative demonstration values pending verified DEM ingestion. Slope mirrors zone base slope.']
    );
  }

  console.log('[seed-upgrade] data_sources, rainfall_observations, soil_observations, terrain_features seeded');
}
