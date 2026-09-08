/**
 * Deterministic Risk Engine for Talweg
 *
 * WHY THIS EXISTS:
 * This is the demo safety net. It calculates landslide risk using a weighted
 * heuristic formula — no ML model, no external service, no network calls.
 * If the FastAPI ML service goes down, or is never started, this engine
 * keeps the entire P0-A demo running.
 *
 * IMPORTANT DISCLAIMERS:
 * - This is a PROTOTYPE decision-support heuristic, not a scientifically
 *   validated model.
 * - The weights are reasonable estimates based on literature patterns
 *   (rainfall is the dominant trigger in NER), but they are NOT calibrated
 *   against ground truth.
 * - Risk levels are for demonstration purposes only.
 *
 * FORMULA:
 *   RiskScore = 0.30 × norm(rainfall_24h)
 *             + 0.20 × norm(rainfall_3d)
 *             + 0.20 × norm(slope)
 *             + 0.15 × norm(soil_moisture)
 *             + 0.15 × norm(historical_density)
 *
 * Each factor is normalized to [0, 1] using domain-specific reference maximums.
 * The final score is clamped to [0, 1].
 */

// ----- Types -----

export interface RiskInput {
  rainfall_24h: number;      // mm in last 24 hours
  rainfall_3d: number;       // mm in last 3 days
  rainfall_5d?: number;      // mm in last 5 days
  rainfall_7d?: number;      // mm in last 7 days
  soil_moisture: number;     // 0.0 to 1.0
  slope: number;             // degrees
  historical_density: number; // count of events in the zone
  rainfall_history?: number[]; // daily precipitation history (mm)
  zone_id?: string;
  latitude?: number;
  longitude?: number;
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface FactorContribution {
  factor: string;
  raw: number;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface ThresholdSignal {
  exceeded: boolean;
  max_ratio: number;
  critical_duration_days: number;
  ratios: {
    d1: number;
    d3: number;
    d7: number;
  };
  citation: string;
}

export interface UncertaintyInfo {
  in_domain: boolean;
  clamped_features: string[];
  domain_warning?: string | null;
}

export interface RiskResult {
  risk_score: number;
  risk_level: RiskLevel;
  contributing_factors: FactorContribution[];
  engine: 'deterministic' | 'ml' | 'hybrid';
  timestamp: string;
  model_version?: string;
  model_role?: string;
  is_probability?: boolean;
  fallback_used?: boolean;
  fallback_reason?: string | null;
  data_quality_score?: number;
  ml_score?: number;
  deterministic_score?: number;
  ml_vs_deterministic_delta?: number | null;
  threshold_signal?: ThresholdSignal;
  safety_override?: boolean;
  safety_reason?: string;
  uncertainty?: UncertaintyInfo;
}

// ----- Configuration -----
// Weights must sum to 1.0. Centralized here for easy tuning.

export const RISK_WEIGHTS = {
  rainfall_24h: 0.30,
  rainfall_3d: 0.20,
  slope: 0.20,
  soil_moisture: 0.15,
  historical_density: 0.15,
} as const;

/**
 * Reference maximums for normalization.
 */
export const NORMALIZATION_MAX = {
  rainfall_24h: 200,
  rainfall_3d: 500,
  slope: 60,
  soil_moisture: 1.0,
  historical_density: 10,
} as const;

/**
 * Risk level thresholds (from PRD).
 * Score ranges: LOW [0, 0.3), MODERATE [0.3, 0.56), HIGH [0.56, 0.8), SEVERE [0.8, 1.0]
 */
export const RISK_THRESHOLDS: { max: number; level: RiskLevel }[] = [
  { max: 0.30, level: 'LOW' },
  { max: 0.56, level: 'MODERATE' },
  { max: 0.80, level: 'HIGH' },
  { max: 1.00, level: 'SEVERE' },
];

const LEVEL_ORDER: Record<RiskLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

// ----- Core Functions -----

/**
 * Normalize a raw value to [0, 1] given a reference maximum.
 * Values exceeding the max are clamped to 1.0.
 * Negative values are clamped to 0.0.
 */
export function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/**
 * Determine risk level from a score.
 */
export function classifyRisk(score: number): RiskLevel {
  for (const threshold of RISK_THRESHOLDS) {
    if (score <= threshold.max) {
      return threshold.level;
    }
  }
  return 'SEVERE';
}

/**
 * Evaluates rainfall against published regional Intensity-Duration threshold
 * for Sikkim Himalaya: I = 43.26 * D^(-0.78), where I is mm/day and D is days.
 */
export function calculateThresholdSignal(
  rainfall_24h: number,
  rainfall_3d: number,
  rainfall_7d?: number
): ThresholdSignal {
  const r24 = Math.max(0, rainfall_24h);
  const r3d = Math.max(0, rainfall_3d);
  const r7d = Math.max(r3d, rainfall_7d ?? r3d);

  // D=1: threshold = 43.26 mm
  const thresh1 = 43.26;
  const ratio1 = Math.round((r24 / thresh1) * 1000) / 1000;

  // D=3: daily intensity threshold = 43.26 * 3^(-0.78) ~= 18.3688 mm/day -> 3-day sum ~= 55.106 mm
  const thresh3 = 55.106;
  const ratio3 = Math.round((r3d / thresh3) * 1000) / 1000;

  // D=7: daily intensity threshold = 43.26 * 7^(-0.78) ~= 9.465 mm/day -> 7-day sum ~= 66.255 mm
  const thresh7 = 66.255;
  const ratio7 = Math.round((r7d / thresh7) * 1000) / 1000;

  const max_ratio = Math.max(ratio1, ratio3, ratio7);
  let critical_duration = 1;
  if (max_ratio === ratio3) critical_duration = 3;
  else if (max_ratio === ratio7) critical_duration = 7;

  return {
    exceeded: max_ratio >= 1.0,
    max_ratio,
    critical_duration_days: critical_duration,
    ratios: {
      d1: ratio1,
      d3: ratio3,
      d7: ratio7,
    },
    citation: 'Regional Sikkim threshold: I = 43.26 * D^(-0.78) (mm/day)',
  };
}

/**
 * Calculates Antecedent Rainfall Index (ARI) with exponential decay.
 * ARI_t = sum(r_{t-k} * exp(-k / tau)), tau = 3 days, window K = 7 days.
 */
export function calculateARI(
  rainfall_24h: number,
  rainfall_3d: number,
  rainfall_7d?: number,
  history?: number[]
): number {
  if (history && history.length > 0) {
    let sum = 0;
    const count = Math.min(history.length, 7);
    for (let k = 0; k < count; k++) {
      sum += Math.max(0, history[k]) * Math.exp(-k / 3.0);
    }
    return Math.round(sum * 100) / 100;
  }

  // Reconstruct daily distribution from available aggregates
  const r0 = Math.max(0, rainfall_24h);
  const r12 = Math.max(0, rainfall_3d - rainfall_24h) / 2.0;
  const r36 = Math.max(0, (rainfall_7d ?? rainfall_3d) - rainfall_3d) / 4.0;

  let sum = r0 * Math.exp(0);
  sum += r12 * Math.exp(-1 / 3.0) + r12 * Math.exp(-2 / 3.0);
  for (let k = 3; k < 7; k++) {
    sum += r36 * Math.exp(-k / 3.0);
  }
  return Math.round(sum * 100) / 100;
}

/**
 * Composes conservative hybrid risk between ML surrogate and physical thresholds.
 * Enforces safety floor: final_level = max(base_level, safety_level).
 * Strong physical rainfall triggers cannot be suppressed by an ML surrogate.
 */
export function composeHybridRisk(
  mlResult: RiskResult,
  deterministicResult: RiskResult,
  thresholdSignal: ThresholdSignal
): RiskResult {
  let safetyLevel: RiskLevel = 'LOW';
  if (thresholdSignal.max_ratio >= 2.0) {
    safetyLevel = 'SEVERE';
  } else if (thresholdSignal.max_ratio >= 1.3) {
    safetyLevel = 'HIGH';
  } else if (thresholdSignal.max_ratio >= 1.0) {
    safetyLevel = 'MODERATE';
  }

  const baseLevel = mlResult.risk_level;
  const mlRank = LEVEL_ORDER[baseLevel];
  const safetyRank = LEVEL_ORDER[safetyLevel];

  const safetyOverride = safetyRank > mlRank;
  const finalLevel: RiskLevel = safetyOverride ? safetyLevel : baseLevel;

  let finalScore = mlResult.risk_score;
  if (safetyOverride) {
    if (safetyLevel === 'SEVERE' && finalScore < 0.81) finalScore = 0.82;
    else if (safetyLevel === 'HIGH' && finalScore < 0.57) finalScore = 0.58;
    else if (safetyLevel === 'MODERATE' && finalScore < 0.31) finalScore = 0.32;
  }

  const delta = Math.round(Math.abs(mlResult.risk_score - deterministicResult.risk_score) * 1000) / 1000;

  return {
    ...mlResult,
    risk_score: finalScore,
    risk_level: finalLevel,
    engine: 'hybrid',
    is_probability: false,
    model_version: mlResult.model_version || 'synthetic-surrogate-0.1.0',
    model_role: 'synthetic_function_approximation',
    fallback_used: false,
    fallback_reason: null,
    ml_score: mlResult.risk_score,
    deterministic_score: deterministicResult.risk_score,
    ml_vs_deterministic_delta: delta,
    threshold_signal: thresholdSignal,
    safety_override: safetyOverride,
    safety_reason: safetyOverride
      ? `Physical rainfall threshold exceeded by factor of ${thresholdSignal.max_ratio.toFixed(2)}x (${thresholdSignal.critical_duration_days}d duration). Conservative safety floor (${safetyLevel}) enforced.`
      : undefined,
  };
}

/**
 * Calculate the deterministic risk score.
 *
 * Returns a full RiskResult including the score, level, and a breakdown
 * of each factor's contribution.
 */
export function calculateRisk(input: RiskInput): RiskResult {
  const factors: FactorContribution[] = [];

  // Normalize each input factor
  const entries: { factor: keyof RiskInput; raw: number }[] = [
    { factor: 'rainfall_24h', raw: input.rainfall_24h },
    { factor: 'rainfall_3d', raw: input.rainfall_3d },
    { factor: 'slope', raw: input.slope },
    { factor: 'soil_moisture', raw: input.soil_moisture },
    { factor: 'historical_density', raw: input.historical_density },
  ];

  let totalScore = 0;

  for (const entry of entries) {
    const weight = RISK_WEIGHTS[entry.factor as keyof typeof RISK_WEIGHTS];
    const normalized = normalize(entry.raw, NORMALIZATION_MAX[entry.factor as keyof typeof NORMALIZATION_MAX]);
    const contribution = weight * normalized;
    totalScore += contribution;

    factors.push({
      factor: entry.factor,
      raw: entry.raw,
      normalized: Math.round(normalized * 1000) / 1000,
      weight,
      contribution: Math.round(contribution * 1000) / 1000,
    });
  }

  // Clamp final score to [0, 1] and round to 3 decimal places
  const risk_score = Math.round(Math.max(0, Math.min(1, totalScore)) * 1000) / 1000;

  // Sort factors by contribution descending — most impactful first
  factors.sort((a, b) => b.contribution - a.contribution);

  const threshold_signal = calculateThresholdSignal(input.rainfall_24h, input.rainfall_3d, input.rainfall_7d);

  return {
    risk_score,
    risk_level: classifyRisk(risk_score),
    contributing_factors: factors,
    engine: 'deterministic',
    is_probability: false,
    threshold_signal,
    fallback_used: false,
    fallback_reason: null,
    timestamp: new Date().toISOString(),
  };
}
