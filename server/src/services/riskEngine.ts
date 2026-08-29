/**
 * Deterministic Risk Engine for SlopeGuard AI
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
  soil_moisture: number;     // 0.0 to 1.0
  slope: number;             // degrees
  historical_density: number; // count of events in the zone
}

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface FactorContribution {
  factor: string;
  raw: number;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface RiskResult {
  risk_score: number;
  risk_level: RiskLevel;
  contributing_factors: FactorContribution[];
  engine: 'deterministic' | 'ml';
  timestamp: string;
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
 *
 * WHY THESE VALUES:
 * - rainfall_24h: 200mm is extreme 24h rainfall for Sikkim (IMD records show
 *   150-200mm as "extremely heavy"). Values above this are capped at 1.0.
 * - rainfall_3d: 500mm over 3 days represents a severe multi-day event.
 * - slope: 60° is near-vertical; most mass wasting occurs on 25-45° slopes.
 * - soil_moisture: already 0-1 normalized, max is 1.0.
 * - historical_density: 10 events in a zone is high for our prototype area.
 *
 * These are prototype reference points, not scientifically calibrated thresholds.
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
 * Calculate the deterministic risk score.
 *
 * Returns a full RiskResult including the score, level, and a breakdown
 * of each factor's contribution — this breakdown drives the explanation
 * layer in P0-B without needing an LLM.
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
    const weight = RISK_WEIGHTS[entry.factor];
    const normalized = normalize(entry.raw, NORMALIZATION_MAX[entry.factor]);
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

  return {
    risk_score,
    risk_level: classifyRisk(risk_score),
    contributing_factors: factors,
    engine: 'deterministic',
    timestamp: new Date().toISOString(),
  };
}
