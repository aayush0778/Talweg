/**
 * Hybrid Risk Composer (Final Upgrade Spec §16)
 *
 * Canonical logical order:
 *   1. Validate inputs          (reject NaN/Infinity — spec §14)
 *   2. Calculate data quality   (heuristic, honest — spec §13)
 *   3. Calculate rainfall-derived signals (windows, ARI, threshold ratio)
 *   4. Run surrogate/empirical model if available (with fallback seam)
 *   5. Run deterministic safety rules     (rainfall threshold engine)
 *   6. Apply safety floor                 (final = max(base, safety))
 *   7. Calculate explainability metadata  (attribution vs rules kept separate)
 *   8. Return final risk
 *
 * Model modes (spec §1.2):
 *   - synthetic_surrogate : frozen ExtraTrees surrogate / deterministic engine
 *   - hybrid_prototype    : model output composed with threshold safety rules
 *   - empirical_model     : RESERVED — never silently selected
 */

import { config } from '../config';
import { RiskInput, RiskResult, calculateRisk } from './riskEngine';
import { evaluateRisk } from './riskEvaluator';
import {
  evaluateRainfallThreshold,
  applySafetyFloor,
  minimumScoreForLevel,
  SafetyLevel,
  ThresholdEvaluation,
} from './rainfallThreshold';
import { calculateAriFromAggregates } from './rainfallFeatures';
import { assessDataQuality, legacyDataQualityScore } from './dataQuality';
import {
  FEATURE_SCHEMA_VERSION,
  FeatureRecord,
  ProvenanceType,
} from '../schemas/featureSchema';

export const MODEL_VERSION = 'synthetic-surrogate-0.1.0';
export const MODEL_ROLE = 'synthetic_function_approximation';
export const TRAINING_DATA_VERSION = 'synthetic-grid-uniform-seed42-v1';

export type ModelMode = 'synthetic_surrogate' | 'hybrid_prototype' | 'empirical_model';

export interface DeterministicRuleSignal {
  rule: string;
  status: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  detail: string;
}

export interface HybridRiskOutput {
  risk_index: number;
  risk_level: SafetyLevel;
  model_mode: ModelMode;
  ml: {
    score: number | null;
    model_version: string;
    is_probability: false;
    used: boolean;
  };
  deterministic: {
    score: number;
    contributing_factors: RiskResult['contributing_factors'];
  };
  rainfall_threshold: {
    duration_days: number | null;
    observed_intensity: number | null;
    threshold: number | null;
    ratio: number | null;
    band: string;
    safety_level: SafetyLevel;
    /** full per-duration evaluation (1/3/5/7-day) */
    evaluation: ThresholdEvaluation;
  };
  antecedent_rainfall_index: number | null;
  data_quality: {
    completeness: number;
    data_quality_score: number;
    source_quality: number;
    temporal_alignment: number;
    spatial_alignment: number;
  };
  uncertainty: {
    domain_warning: boolean;
    clamped_features: string[];
    message: string | null;
  };
  triggered_rules: DeterministicRuleSignal[];
  fallback_used: boolean;
  fallback_reason: string | null;
  model_version: string;
  model_role: string;
  is_probability: false;
  feature_schema_version: string;
  timestamp: string;
}

export interface ComposeOptions {
  /** provenance class per core feature (REAL/DERIVED/SYNTHETIC/UNKNOWN) */
  provenanceByFeature?: Record<string, ProvenanceType>;
  /** optional canonical FeatureRecord enabling richer quality assessment */
  featureRecord?: FeatureRecord;
  rainfallProvenance?: 'REAL' | 'DERIVED' | 'SYNTHETIC';
  rainfallSourceId?: string;
  /** override the ML query seam (for tests) */
  evaluate?: typeof evaluateRisk;
  mode?: 'deterministic' | 'ml';
}

/** Core prototype domain boundaries (parity with riskEngine NORMALIZATION_MAX). */
export const DOMAIN_BOUNDS: Record<string, [number, number]> = {
  rainfall_24h: [0, 200],
  rainfall_3d: [0, 500],
  soil_moisture: [0, 1],
  slope: [0, 60],
  historical_density: [0, 10],
};

/**
 * 1. VALIDATE — hard-reject non-finite values; record soft domain clamps.
 */
function validateInput(input: RiskInput): { clamped: string[] } {
  const numericFields: (keyof RiskInput)[] = [
    'rainfall_24h', 'rainfall_3d', 'soil_moisture', 'slope', 'historical_density',
  ];
  for (const field of numericFields) {
    const v = input[field];
    if (typeof v === 'number' && !Number.isFinite(v)) {
      const err = new Error(`Feature '${field}' must be a finite number (NaN/Infinity rejected)`) as Error & {
        statusCode?: number;
        code?: string;
      };
      err.statusCode = 400;
      err.code = 'NON_FINITE_INPUT';
      throw err;
    }
  }
  const clamped: string[] = [];
  for (const [field, [min, max]] of Object.entries(DOMAIN_BOUNDS)) {
    const v = input[field as keyof RiskInput];
    if (typeof v === 'number' && (v < min || v > max)) clamped.push(field);
  }
  return { clamped };
}

/** Deterministic safety/explainability rules evaluated alongside the threshold engine. */
function evaluateRules(
  input: RiskInput,
  threshold: ThresholdEvaluation
): DeterministicRuleSignal[] {
  const rules: DeterministicRuleSignal[] = [];

  rules.push({
    rule: 'rainfall_threshold',
    status: threshold.safety_level,
    detail:
      threshold.max_ratio !== null
        ? `${threshold.critical_duration_days}-day rainfall at ${threshold.max_ratio.toFixed(2)}× the regional threshold`
        : 'Rainfall windows unavailable — threshold not evaluated',
  });

  const slopeNorm = Math.min(1, Math.max(0, input.slope / 60));
  rules.push({
    rule: 'terrain_rule',
    status: slopeNorm >= 0.7 ? 'HIGH' : slopeNorm >= 0.4 ? 'MODERATE' : 'LOW',
    detail: `Slope ${Math.round(input.slope * 10) / 10}°`,
  });

  rules.push({
    rule: 'soil_saturation_rule',
    status: input.soil_moisture >= 0.8 ? 'HIGH' : input.soil_moisture >= 0.55 ? 'MODERATE' : 'LOW',
    detail: `Soil moisture ${Math.round(input.soil_moisture * 100)}%`,
  });

  rules.push({
    rule: 'historical_density_rule',
    status: input.historical_density >= 6 ? 'HIGH' : input.historical_density >= 3 ? 'MODERATE' : 'LOW',
    detail: `${input.historical_density} historical events in/near zone`,
  });

  return rules;
}

/**
 * Compose the canonical hybrid risk (spec §16 response shape).
 */
export async function composeHybrid(
  input: RiskInput,
  opts: ComposeOptions = {}
): Promise<HybridRiskOutput> {
  // 1. Validate
  const { clamped } = validateInput(input);

  // 2. Data quality
  const provenance = opts.provenanceByFeature ?? {};
  let quality = legacyDataQualityScore(
    {
      rainfall_24h: provenance.rainfall_24h ?? 'SYNTHETIC',
      rainfall_3d: provenance.rainfall_3d ?? 'SYNTHETIC',
      soil_moisture: provenance.soil_moisture ?? 'SYNTHETIC',
      slope: provenance.slope ?? 'DERIVED',
      historical_density: provenance.historical_density ?? 'DERIVED',
    },
    clamped
  );
  let completeness: number | null = null;
  let sourceQuality: number | null = null;
  let temporalAlignment: number | null = null;
  let spatialAlignment: number | null = null;
  if (opts.featureRecord) {
    const q = assessDataQuality(opts.featureRecord);
    quality = q.data_quality_score;
    completeness = q.feature_completeness;
    sourceQuality = q.source_quality;
    temporalAlignment = q.temporal_alignment;
    spatialAlignment = q.spatial_alignment;
  }

  // 3. Rainfall-derived signals
  const threshold = evaluateRainfallThreshold(input, {
    rainfall_provenance: opts.rainfallProvenance ?? 'SYNTHETIC',
    source_id: opts.rainfallSourceId ?? 'seed-telemetry',
  });
  const ari =
    calculateAriFromAggregates(input.rainfall_24h, input.rainfall_3d, input.rainfall_7d ?? null);

  // 4. Run model (surrogate with deterministic fallback seam)
  const evaluateFn = opts.evaluate ?? evaluateRisk;
  const evalMode = opts.mode ?? config.riskEngineMode;
  const result = await evaluateFn(input, { mode: evalMode });

  // 5–6. Deterministic safety rules + floor
  const rules = evaluateRules(input, threshold);
  const baseLevel = result.risk_level as SafetyLevel;
  const { final_level, escalated } = applySafetyFloor(baseLevel, threshold.safety_level);
  let finalScore = result.risk_score;
  if (escalated) {
    finalScore = Math.max(finalScore, minimumScoreForLevel(threshold.safety_level));
    finalScore = Math.round(finalScore * 1000) / 1000;
  }

  const modelMode: ModelMode =
    result.fallback_used || evalMode === 'deterministic'
      ? 'synthetic_surrogate'
      : 'hybrid_prototype';

  const critical = threshold.critical_duration_days
    ? threshold.durations.find((d) => d.duration_days === threshold.critical_duration_days) ?? null
    : null;

  // 7–8. Explainability + final response
  return {
    risk_index: finalScore,
    risk_level: final_level,
    model_mode: modelMode,
    ml: {
      score: result.ml_score ?? null,
      model_version: result.model_version ?? MODEL_VERSION,
      is_probability: false,
      used: evalMode === 'ml' && !result.fallback_used,
    },
    deterministic: {
      score: result.deterministic_score ?? calculateRisk(input).risk_score,
      contributing_factors: result.contributing_factors,
    },
    rainfall_threshold: {
      duration_days: critical?.duration_days ?? null,
      observed_intensity: critical?.observed_intensity ?? null,
      threshold: critical?.threshold_cumulative_mm ?? null,
      ratio: critical?.ratio ?? null,
      band: critical?.band ?? 'below',
      safety_level: threshold.safety_level,
      evaluation: threshold,
    },
    antecedent_rainfall_index: ari,
    data_quality: {
      completeness: completeness ?? Math.round(quality * 1000) / 1000,
      data_quality_score: quality,
      source_quality: sourceQuality ?? quality,
      temporal_alignment: temporalAlignment ?? 1,
      spatial_alignment: spatialAlignment ?? 1,
    },
    uncertainty: {
      domain_warning: clamped.length > 0,
      clamped_features: clamped,
      message:
        clamped.length > 0
          ? 'Input exceeds validated prototype domain.'
          : null,
    },
    triggered_rules: rules,
    fallback_used: Boolean(result.fallback_used) || evalMode === 'deterministic',
    fallback_reason:
      result.fallback_reason ??
      (evalMode === 'deterministic'
        ? 'RISK_ENGINE_MODE=deterministic — deterministic engine used by configuration'
        : null),
    model_version: MODEL_VERSION,
    model_role: MODEL_ROLE,
    is_probability: false,
    feature_schema_version: FEATURE_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
  };
}
