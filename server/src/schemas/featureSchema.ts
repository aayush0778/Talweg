/**
 * Canonical Feature Contract (Final Upgrade Spec §4.1)
 *
 * One schema shared conceptually by ingestion, ML, API and UI.
 * Every environmental value carries its own provenance, quality status and
 * (where applicable) temporal/spatial alignment metadata.
 *
 * HARD RULES (spec §4.1):
 * - Do NOT force unavailable fields to zero. `0` means an observed zero;
 *   `null` means missing.
 * - Every value must be traceable to a source (`source_id`) and a
 *   provenance type (REAL | DERIVED | SYNTHETIC | UNKNOWN).
 */

export const FEATURE_SCHEMA_VERSION = '1.0.0';

export type ProvenanceType = 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'UNKNOWN';

export type QualityStatus = 'VALID' | 'PARTIAL' | 'MISSING' | 'INVALID';

export type AlignmentStatus = 'aligned' | 'partial' | 'unknown' | 'invalid';

export interface FeatureValue {
  /** null = missing (never substitute 0 for a missing observation) */
  value: number | string | null;
  unit: string;
  source_id: string;
  provenance_type: ProvenanceType;
  observed_at?: string;
  window_start?: string;
  window_end?: string;
  /** e.g. 'EPSG:4326', 'SRTM 30m DEM' */
  spatial_reference?: string;
  /** distance between observation location and target location, km */
  spatial_distance_km?: number;
  /** transformation applied (e.g. 'rolling_sum_3d', 'exp_decay_tau3d') */
  transformation?: string;
  quality_status: QualityStatus;
}

export interface FeatureRecordLocation {
  latitude: number;
  longitude: number;
  zone_id?: string;
}

/**
 * Canonical feature record. All fields optional — absent means "not
 * available for this location/time", never zero.
 */
export interface FeatureRecord {
  feature_schema_version: string;
  location: FeatureRecordLocation;
  as_of: string;
  features: {
    // Rainfall family
    rainfall_24h?: FeatureValue;
    rainfall_3d?: FeatureValue;
    rainfall_5d?: FeatureValue;
    rainfall_7d?: FeatureValue;
    rainfall_intensity?: FeatureValue;
    rainfall_percentile?: FeatureValue;
    rainfall_anomaly?: FeatureValue;
    antecedent_rainfall_index?: FeatureValue;
    threshold_exceedance_ratio?: FeatureValue;
    threshold_exceedance_duration?: FeatureValue;
    // Terrain family
    slope?: FeatureValue;
    aspect?: FeatureValue;
    elevation?: FeatureValue;
    curvature?: FeatureValue;
    terrain_ruggedness?: FeatureValue;
    relative_relief?: FeatureValue;
    // Soil family
    soil_moisture?: FeatureValue;
    soil_type?: FeatureValue;
    soil_depth?: FeatureValue;
    sand_fraction?: FeatureValue;
    silt_fraction?: FeatureValue;
    clay_fraction?: FeatureValue;
    bulk_density?: FeatureValue;
    hydraulic_conductivity?: FeatureValue;
    available_water_capacity?: FeatureValue;
    organic_carbon?: FeatureValue;
    // History / context family
    historical_density?: FeatureValue;
    distance_to_historical_event?: FeatureValue;
    geology_class?: FeatureValue;
    land_cover?: FeatureValue;
    vegetation_index?: FeatureValue;
  };
  /** fraction [0,1] of expected core features that are VALID */
  completeness: number;
  alignment_status: AlignmentStatus;
}

/** Keys considered core for risk computation completeness (5 prototype inputs + rainfall memory). */
export const CORE_FEATURE_KEYS = [
  'rainfall_24h',
  'rainfall_3d',
  'slope',
  'soil_moisture',
  'historical_density',
] as const;

/** All canonical feature keys, for completeness/quality accounting. */
export const ALL_FEATURE_KEYS = [
  'rainfall_24h', 'rainfall_3d', 'rainfall_5d', 'rainfall_7d',
  'rainfall_intensity', 'rainfall_percentile', 'rainfall_anomaly',
  'antecedent_rainfall_index', 'threshold_exceedance_ratio', 'threshold_exceedance_duration',
  'slope', 'aspect', 'elevation', 'curvature', 'terrain_ruggedness', 'relative_relief',
  'soil_moisture', 'soil_type', 'soil_depth', 'sand_fraction', 'silt_fraction', 'clay_fraction',
  'bulk_density', 'hydraulic_conductivity', 'available_water_capacity', 'organic_carbon',
  'historical_density', 'distance_to_historical_event', 'geology_class', 'land_cover', 'vegetation_index',
] as const;

export type FeatureKey = (typeof ALL_FEATURE_KEYS)[number];

/**
 * Convenience factory for a numeric feature value.
 * `null` value → quality_status MISSING (0 is never substituted).
 */
export function makeFeatureValue(
  _key: string,
  value: number | string | null,
  opts: {
    unit: string;
    sourceId: string;
    provenance: ProvenanceType;
    observedAt?: string;
    windowStart?: string;
    windowEnd?: string;
    spatialReference?: string;
    spatialDistanceKm?: number;
    transformation?: string;
    qualityStatus?: QualityStatus;
  }
): FeatureValue {
  let quality = opts.qualityStatus ?? 'VALID';
  if (value === null || value === undefined) {
    quality = 'MISSING';
  } else if (typeof value === 'number' && !Number.isFinite(value)) {
    quality = 'INVALID';
  }
  const fv: FeatureValue = {
    value: value ?? null,
    unit: opts.unit,
    source_id: opts.sourceId,
    provenance_type: opts.provenance,
    quality_status: quality,
  };
  if (opts.observedAt) fv.observed_at = opts.observedAt;
  if (opts.windowStart) fv.window_start = opts.windowStart;
  if (opts.windowEnd) fv.window_end = opts.windowEnd;
  if (opts.spatialReference) fv.spatial_reference = opts.spatialReference;
  if (opts.spatialDistanceKm !== undefined) fv.spatial_distance_km = opts.spatialDistanceKm;
  if (opts.transformation) fv.transformation = opts.transformation;
  return fv;
}

/**
 * Completeness = fraction of CORE features that are present and VALID.
 * Computed only over the 5 prototype core inputs.
 */
export function computeCompleteness(features: FeatureRecord['features']): number {
  let valid = 0;
  for (const key of CORE_FEATURE_KEYS) {
    const fv = features[key];
    if (fv && fv.value !== null && fv.quality_status === 'VALID') valid += 1;
  }
  return Math.round((valid / CORE_FEATURE_KEYS.length) * 1000) / 1000;
}

/**
 * Alignment status derived from the underlying value alignments:
 * - 'aligned'  : all present core values observed at/for the requested location & time
 * - 'partial'  : some values approximated (spatially or temporally) or derived
 * - 'unknown'  : provenance unknown for any core value
 * - 'invalid'  : any core value INVALID
 */
export function computeAlignmentStatus(features: FeatureRecord['features']): AlignmentStatus {
  let sawPartial = false;
  for (const key of CORE_FEATURE_KEYS) {
    const fv = features[key];
    if (!fv || fv.value === null) continue; // missing handled by completeness
    if (fv.quality_status === 'INVALID') return 'invalid';
    if (fv.provenance_type === 'UNKNOWN') return 'unknown';
    if (fv.provenance_type === 'DERIVED' || fv.provenance_type === 'SYNTHETIC') sawPartial = true;
    if (fv.spatial_distance_km !== undefined && fv.spatial_distance_km > 0) sawPartial = true;
  }
  return sawPartial ? 'partial' : 'aligned';
}
