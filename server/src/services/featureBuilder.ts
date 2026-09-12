/**
 * Feature Builder (Final Upgrade Spec §4.1, §5, §6, §7)
 *
 * Assembles the canonical FeatureRecord for a zone by combining every
 * available feature family:
 *   - rainfall daily series   → rolling windows (24h/3d/5d/7d), intensity, ARI
 *   - environmental obs       → soil moisture
 *   - terrain features        → slope, elevation, aspect, curvature, ruggedness
 *   - soil observations       → soil type/texture, fractions, depth
 *   - landslide inventory     → historical density, distance to nearest event
 *
 * Every value carries provenance. Missing families are simply absent/MISSING —
 * never zero-filled, never substituted with fabricated data.
 */

import { query, isDbError } from '../db/query';
import { FALLBACK_ZONES } from '../db/fallbackData';
import {
  FeatureRecord,
  makeFeatureValue,
  computeCompleteness,
  computeAlignmentStatus,
  FEATURE_SCHEMA_VERSION,
} from '../schemas/featureSchema';
import { buildRainfallFeatures, RainfallObservation } from './rainfallFeatures';
import { evaluateRainfallThreshold } from './rainfallThreshold';
import { resolveZoneRiskInputs } from './zoneRiskInputs';

interface SoilRow {
  soil_type: string | null;
  soil_texture: string | null;
  soil_depth_m: number | null;
  sand_fraction: number | null;
  silt_fraction: number | null;
  clay_fraction: number | null;
  bulk_density_g_cm3: number | null;
  hydraulic_conductivity_mm_h: number | null;
  available_water_capacity_mm: number | null;
  organic_carbon_percent: number | null;
  observed_at: Date | string;
  source_id: string;
  provenance: string;
  quality_status: string;
}

interface TerrainRow {
  elevation_m: number | null;
  slope_deg: number | null;
  aspect_deg: number | null;
  curvature: number | null;
  terrain_ruggedness: number | null;
  relative_relief_m: number | null;
  drainage_proximity_m: number | null;
  road_cut_proximity_m: number | null;
  observed_at: Date | string;
  source_id: string;
  provenance: string;
  dem_reference: string | null;
}

async function safeQuery<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    // Degrade gracefully to MISSING for DB unavailability — including the
    // mapped ApiError('DATABASE_ERROR') thrown by the query helper — and
    // for tables that don't exist yet (undefined_column / invalid table).
    if (isDbError(err)) return null;
    const code = (err as { code?: string })?.code;
    if (code === 'DATABASE_ERROR' || code === '42P01' || code === '42703') return null;
    throw err;
  }
}

export interface BuiltFeatureRecord {
  record: FeatureRecord;
  rainfall_provenance: 'REAL' | 'DERIVED' | 'SYNTHETIC';
  fallback_mode: boolean;
}

/**
 * Build the canonical FeatureRecord for a zone.
 * as_of = latest rainfall observation (or now when no series exists).
 */
export async function buildZoneFeatureRecord(zoneId: string): Promise<BuiltFeatureRecord | null> {
  const resolved = await resolveZoneRiskInputs(zoneId);
  if (!resolved.context) return null;
  const ctx = resolved.context;

  // ----- Rainfall daily series -----
  let series: RainfallObservation[] = [];
  let seriesProvenance: 'REAL' | 'DERIVED' | 'SYNTHETIC' = 'SYNTHETIC';
  let seriesSourceId = 'seed-telemetry';
  const seriesRes = await safeQuery(() =>
    query<{ observed_at: Date | string; precip_mm: number; source_id: string; provenance: string }>(
      `SELECT observed_at, precip_mm, source_id, provenance
       FROM rainfall_observations
       WHERE zone_id = $1 AND observed_at >= NOW() - INTERVAL '10 days'
       ORDER BY observed_at ASC;`,
      [zoneId]
    )
  );
  if (seriesRes && seriesRes.rows.length > 0) {
    series = seriesRes.rows.map((r) => ({
      date: new Date(r.observed_at).toISOString(),
      precip_mm: r.precip_mm,
    }));
    seriesSourceId = seriesRes.rows[0].source_id;
    seriesProvenance =
      seriesRes.rows[0].provenance === 'REAL'
        ? 'REAL'
        : seriesRes.rows[0].provenance === 'DERIVED'
          ? 'DERIVED'
          : 'SYNTHETIC';
  }

  const asOf = series.length > 0 ? series[series.length - 1].date : new Date().toISOString();
  const windows = buildRainfallFeatures(series, { asOf });

  // ----- Soil -----
  const soilRes = await safeQuery(() =>
    query<SoilRow>(
      `SELECT soil_type, soil_texture, soil_depth_m, sand_fraction, silt_fraction, clay_fraction,
              bulk_density_g_cm3, hydraulic_conductivity_mm_h, available_water_capacity_mm,
              organic_carbon_percent, observed_at, source_id, provenance, quality_status
       FROM soil_observations WHERE zone_id = $1
       ORDER BY observed_at DESC LIMIT 1;`,
      [zoneId]
    )
  );
  const soil = soilRes?.rows[0] ?? null;
  const soilProvenance = (soil?.provenance as 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'UNKNOWN') ?? 'UNKNOWN';

  // ----- Terrain -----
  const terrainRes = await safeQuery(() =>
    query<TerrainRow>(
      `SELECT elevation_m, slope_deg, aspect_deg, curvature, terrain_ruggedness, relative_relief_m,
              drainage_proximity_m, road_cut_proximity_m, observed_at, source_id, provenance, dem_reference
       FROM terrain_features WHERE zone_id = $1
       ORDER BY observed_at DESC LIMIT 1;`,
      [zoneId]
    )
  );
  const terrain = terrainRes?.rows[0] ?? null;

  // In-memory fallback: zones carry base_slope + centroid; no soil/terrain/series tables.
  if (ctx.fallback_mode && series.length === 0 && !soil && !terrain) {
    const fz = FALLBACK_ZONES.find((z) => z.id === zoneId);
    if (fz) {
      seriesProvenance = 'SYNTHETIC';
    }
  }

  // ----- Historical distance -----
  let distanceKm: number | null = null;
  if (ctx.centroid) {
    const distRes = await safeQuery(() =>
      query<{ distance_m: number | null }>(
        `SELECT ST_Distance(e.geometry, ST_SetSRID(ST_Point($2, $1), 4326))::float AS distance_m
         FROM landslide_events e
         ORDER BY e.geometry <-> ST_SetSRID(ST_Point($2, $1), 4326)
         LIMIT 1;`,
        [ctx.centroid!.latitude, ctx.centroid!.longitude]
      )
    );
    if (distRes?.rows[0]?.distance_m != null) {
      distanceKm = Math.round((distRes.rows[0].distance_m / 1000) * 100) / 100;
    }
  }

  // ----- Threshold evaluation on resolved windows -----
  const threshold = evaluateRainfallThreshold(
    {
      rainfall_24h: windows.rainfall_24h,
      rainfall_3d: windows.rainfall_3d,
      rainfall_5d: windows.rainfall_5d,
      rainfall_7d: windows.rainfall_7d,
    },
    { rainfall_provenance: seriesProvenance, source_id: seriesSourceId }
  );
  const critical =
    threshold.critical_duration_days !== null
      ? threshold.durations.find((d) => d.duration_days === threshold.critical_duration_days)!
      : null;

  const windowMeta = {
    windowStart: windows.window_start ?? undefined,
    windowEnd: windows.window_end ?? undefined,
  };

  const features: FeatureRecord['features'] = {};

  // Rainfall family
  features.rainfall_24h = makeFeatureValue('rainfall_24h', windows.rainfall_24h, {
    unit: 'mm', sourceId: seriesSourceId, provenance: seriesProvenance,
    observedAt: windows.rainfall_24h !== null ? asOf : undefined,
    transformation: 'rolling_sum_1d', ...windowMeta,
  });
  features.rainfall_3d = makeFeatureValue('rainfall_3d', windows.rainfall_3d, {
    unit: 'mm', sourceId: seriesSourceId, provenance: seriesProvenance,
    observedAt: windows.rainfall_3d !== null ? asOf : undefined,
    transformation: 'rolling_sum_3d', ...windowMeta,
  });
  features.rainfall_5d = makeFeatureValue('rainfall_5d', windows.rainfall_5d, {
    unit: 'mm', sourceId: seriesSourceId, provenance: seriesProvenance,
    observedAt: windows.rainfall_5d !== null ? asOf : undefined,
    transformation: 'rolling_sum_5d', ...windowMeta,
  });
  features.rainfall_7d = makeFeatureValue('rainfall_7d', windows.rainfall_7d, {
    unit: 'mm', sourceId: seriesSourceId, provenance: seriesProvenance,
    observedAt: windows.rainfall_7d !== null ? asOf : undefined,
    transformation: 'rolling_sum_7d', ...windowMeta,
  });
  features.rainfall_intensity = makeFeatureValue('rainfall_intensity', windows.rainfall_intensity, {
    unit: 'mm/day', sourceId: seriesSourceId, provenance: seriesProvenance,
    transformation: 'mean_intensity_available_window', ...windowMeta,
  });
  features.antecedent_rainfall_index = makeFeatureValue(
    'antecedent_rainfall_index',
    windows.antecedent_rainfall_index,
    {
      unit: 'mm (index)', sourceId: seriesSourceId, provenance: seriesProvenance,
      transformation: 'exp_weighted_memory_tau3d', ...windowMeta,
    }
  );
  features.threshold_exceedance_ratio = makeFeatureValue(
    'threshold_exceedance_ratio',
    critical ? critical.ratio : null,
    {
      unit: 'ratio', sourceId: 'sikkim-threshold', provenance: 'DERIVED',
      transformation: 'observed_cumulative_over_I_43.26_D_-0.78', ...windowMeta,
    }
  );
  features.threshold_exceedance_duration = makeFeatureValue(
    'threshold_exceedance_duration',
    critical ? critical.duration_days : null,
    { unit: 'days', sourceId: 'sikkim-threshold', provenance: 'DERIVED' }
  );

  // Soil moisture (from environmental observations)
  const obsProvenance = resolved.provenanceByFeature.soil_moisture ?? 'UNKNOWN';
  features.soil_moisture = makeFeatureValue('soil_moisture', ctx.obs?.soil_moisture ?? null, {
    unit: 'ratio', sourceId: ctx.obs?.source ?? 'unknown', provenance: obsProvenance,
    observedAt: ctx.obs?.timestamp ?? undefined,
  });

  // Terrain family
  if (terrain) {
    const tProv = (terrain.provenance as 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'UNKNOWN') ?? 'DERIVED';
    const tAt = new Date(terrain.observed_at).toISOString();
    features.slope = makeFeatureValue('slope', terrain.slope_deg ?? ctx.obs?.slope ?? ctx.base_slope ?? null, {
      unit: 'degrees', sourceId: terrain.source_id, provenance: tProv,
      observedAt: tAt, spatialReference: terrain.dem_reference ?? undefined,
    });
    features.aspect = makeFeatureValue('aspect', terrain.aspect_deg, {
      unit: 'degrees', sourceId: terrain.source_id, provenance: tProv, observedAt: tAt,
      spatialReference: terrain.dem_reference ?? undefined,
    });
    features.elevation = makeFeatureValue('elevation', terrain.elevation_m, {
      unit: 'm', sourceId: terrain.source_id, provenance: tProv, observedAt: tAt,
      spatialReference: terrain.dem_reference ?? undefined,
    });
    features.curvature = makeFeatureValue('curvature', terrain.curvature, {
      unit: '1/m', sourceId: terrain.source_id, provenance: tProv, observedAt: tAt,
    });
    features.terrain_ruggedness = makeFeatureValue('terrain_ruggedness', terrain.terrain_ruggedness, {
      unit: 'index', sourceId: terrain.source_id, provenance: tProv, observedAt: tAt,
    });
    features.relative_relief = makeFeatureValue('relative_relief', terrain.relative_relief_m, {
      unit: 'm', sourceId: terrain.source_id, provenance: tProv, observedAt: tAt,
    });
  } else {
    features.slope = makeFeatureValue('slope', ctx.obs?.slope ?? ctx.base_slope ?? null, {
      unit: 'degrees', sourceId: ctx.obs?.source ?? 'srtm-dem', provenance: resolved.provenanceByFeature.slope ?? 'DERIVED',
      observedAt: ctx.obs?.timestamp ?? undefined, spatialReference: 'SRTM 30m DEM',
    });
  }

  // Soil family (values absent when no observation — never zero-filled)
  if (soil) {
    const sAt = new Date(soil.observed_at).toISOString();
    const sQuality = (soil.quality_status as 'VALID' | 'PARTIAL' | 'MISSING' | 'INVALID') ?? 'PARTIAL';
    features.soil_type = makeFeatureValue('soil_type', soil.soil_type ?? soil.soil_texture, {
      unit: 'class', sourceId: soil.source_id, provenance: soilProvenance,
      observedAt: sAt, qualityStatus: soil.soil_type || soil.soil_texture ? sQuality : 'MISSING',
    });
    features.soil_depth = makeFeatureValue('soil_depth', soil.soil_depth_m, {
      unit: 'm', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.sand_fraction = makeFeatureValue('sand_fraction', soil.sand_fraction, {
      unit: 'fraction', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.silt_fraction = makeFeatureValue('silt_fraction', soil.silt_fraction, {
      unit: 'fraction', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.clay_fraction = makeFeatureValue('clay_fraction', soil.clay_fraction, {
      unit: 'fraction', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.bulk_density = makeFeatureValue('bulk_density', soil.bulk_density_g_cm3, {
      unit: 'g/cm³', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.hydraulic_conductivity = makeFeatureValue('hydraulic_conductivity', soil.hydraulic_conductivity_mm_h, {
      unit: 'mm/h', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.available_water_capacity = makeFeatureValue('available_water_capacity', soil.available_water_capacity_mm, {
      unit: 'mm', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
    features.organic_carbon = makeFeatureValue('organic_carbon', soil.organic_carbon_percent, {
      unit: '%', sourceId: soil.source_id, provenance: soilProvenance, observedAt: sAt, qualityStatus: sQuality,
    });
  }

  // History family
  features.historical_density = makeFeatureValue('historical_density', ctx.event_count, {
    unit: 'events', sourceId: 'nasa-glc', provenance: 'DERIVED',
    spatialReference: 'zone polygon containment',
  });
  features.distance_to_historical_event = makeFeatureValue('distance_to_historical_event', distanceKm, {
    unit: 'km', sourceId: 'nasa-glc', provenance: 'DERIVED',
    spatialReference: 'zone centroid to nearest event',
  });

  const record: FeatureRecord = {
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    location: {
      latitude: ctx.centroid?.latitude ?? 0,
      longitude: ctx.centroid?.longitude ?? 0,
      zone_id: ctx.zone_id,
    },
    as_of: asOf,
    features,
    completeness: computeCompleteness(features),
    alignment_status: computeAlignmentStatus(features),
  };

  return {
    record,
    rainfall_provenance: seriesProvenance,
    fallback_mode: ctx.fallback_mode,
  };
}
