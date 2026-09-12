/**
 * Data Quality Service (Final Upgrade Spec §13)
 *
 * Computes honest data-quality metadata for a set of feature values.
 * These are HEURISTIC quality indicators, not statistical confidence intervals.
 *
 * Outputs:
 * - feature_completeness : fraction of core features present/valid
 * - source_quality       : weighted by provenance class (REAL=1, DERIVED=0.7, SYNTHETIC=0.35, UNKNOWN=0)
 * - temporal_alignment   : how fresh/aligned the driving observations are (1.0 = at as_of, decays with age)
 * - spatial_alignment    : 1.0 when on-zone, decays with spatial distance
 * - data_quality_score   : overall 0..1 composite
 * - model_mode, out_of_domain_warning passed through by the composer
 */

import { FeatureRecord, FeatureValue, CORE_FEATURE_KEYS } from '../schemas/featureSchema';

export interface DataQualityAssessment {
  data_quality_score: number;
  feature_completeness: number;
  source_quality: number;
  temporal_alignment: number;
  spatial_alignment: number;
  per_feature: Record<string, { quality_status: string; provenance_type: string }>;
}

const PROVENANCE_QUALITY: Record<string, number> = {
  REAL: 1.0,
  DERIVED: 0.7,
  SYNTHETIC: 0.35,
  UNKNOWN: 0.0,
};

/** Max age (hours) after which temporal alignment degrades to ~0.2 (CHIRPS latency reference ~6 weeks). */
const STALENESS_HOURS_FULL = 48;
const STALENESS_HOURS_FLOOR = 24 * 45;

/** Max spatial distance (km) over which spatial alignment decays to ~0.2. */
const SPATIAL_DECAY_KM = 25;

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function computeTemporalAlignment(values: FeatureValue[], asOf: Date): number {
  const observedTimes = values
    .map((v) => v.observed_at ?? v.window_end)
    .filter((t): t is string => typeof t === 'string');
  if (observedTimes.length === 0) return 0.5; // unknown age → neutral, flagged via provenance
  const agesHours = observedTimes.map((t) => {
    const then = new Date(t).getTime();
    if (Number.isNaN(then)) return STALENESS_HOURS_FLOOR;
    return Math.max(0, (asOf.getTime() - then) / 3_600_000);
  });
  const worst = Math.max(...agesHours);
  if (worst <= STALENESS_HOURS_FULL) return 1.0;
  if (worst >= STALENESS_HOURS_FLOOR) return 0.2;
  // linear decay from 1.0 → 0.2 between full-fresh and floor
  const frac = (worst - STALENESS_HOURS_FULL) / (STALENESS_HOURS_FLOOR - STALENESS_HOURS_FULL);
  return round3(1.0 - 0.8 * frac);
}

function computeSpatialAlignment(values: FeatureValue[]): number {
  const distances = values
    .map((v) => v.spatial_distance_km)
    .filter((d): d is number => typeof d === 'number');
  if (distances.length === 0) return 1.0; // no offset recorded → assume on-zone
  const worst = Math.max(...distances);
  if (worst <= 0) return 1.0;
  if (worst >= SPATIAL_DECAY_KM) return 0.2;
  return round3(1.0 - 0.8 * (worst / SPATIAL_DECAY_KM));
}

/**
 * Assess quality of a canonical FeatureRecord.
 */
export function assessDataQuality(record: FeatureRecord, asOf?: Date): DataQualityAssessment {
  const now = asOf ?? new Date(record.as_of);
  const present: FeatureValue[] = [];
  const perFeature: DataQualityAssessment['per_feature'] = {};

  let sourceQualitySum = 0;
  let sourceQualityCount = 0;
  let validCore = 0;

  for (const [key, fv] of Object.entries(record.features)) {
    if (!fv) continue;
    present.push(fv);
    perFeature[key] = { quality_status: fv.quality_status, provenance_type: fv.provenance_type };

    const pq = PROVENANCE_QUALITY[fv.provenance_type] ?? 0;
    // MISSING/INVALID values drag source quality down for that feature
    const statusFactor =
      fv.quality_status === 'VALID' ? 1.0 : fv.quality_status === 'PARTIAL' ? 0.6 : 0.0;
    sourceQualitySum += pq * statusFactor;
    sourceQualityCount += 1;

    if (CORE_FEATURE_KEYS.includes(key as (typeof CORE_FEATURE_KEYS)[number])) {
      if (fv.quality_status === 'VALID' && fv.value !== null) validCore += 1;
    }
  }

  const featureCompleteness = round3(validCore / CORE_FEATURE_KEYS.length);
  const sourceQuality =
    sourceQualityCount === 0 ? 0 : round3(sourceQualitySum / sourceQualityCount);
  const temporalAlignment = computeTemporalAlignment(present, now);
  const spatialAlignment = computeSpatialAlignment(present);

  // Composite: completeness dominates, then source quality, then alignment.
  const composite =
    0.45 * featureCompleteness +
    0.25 * sourceQuality +
    0.15 * temporalAlignment +
    0.15 * spatialAlignment;

  return {
    data_quality_score: round3(composite),
    feature_completeness: featureCompleteness,
    source_quality: sourceQuality,
    temporal_alignment: temporalAlignment,
    spatial_alignment: spatialAlignment,
    per_feature: perFeature,
  };
}

/**
 * Lightweight quality assessment for the legacy (non-canonical) prediction path:
 * derives a score purely from which core inputs carried provenance.
 */
export function legacyDataQualityScore(
  provenanceByFeature: Record<string, 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'UNKNOWN'>,
  clampedFeatures: string[] = []
): number {
  const keys = Object.keys(provenanceByFeature);
  if (keys.length === 0) return 0.5;
  let sum = 0;
  for (const k of keys) {
    sum += PROVENANCE_QUALITY[provenanceByFeature[k]] ?? 0;
  }
  let score = sum / keys.length;
  if (clampedFeatures.length > 0) score *= 0.85; // out-of-domain penalty (spec §14)
  return round3(score);
}
