/**
 * Rainfall Threshold Engine — Sikkim regional intensity–duration relationship
 * (Final Upgrade Spec §8)
 *
 *   I = 43.26 × D^-0.78
 *
 * where I = rainfall intensity (mm/day) and D = duration (days).
 * Supported durations: D = 1, 3, 5, 7 days.
 *
 * Threshold ratio interpretation bands (prototype safety bands, NOT universal
 * scientific laws — spec §8.1):
 *   < 1.0        below threshold
 *   1.0 – 1.3    threshold approached/exceeded
 *   1.3 – 2.0    strong exceedance
 *   >= 2.0       extreme exceedance
 *
 * Safety floor (spec §8.2):
 *   ratio >= 1.3 → minimum HIGH
 *   ratio >= 2.0 → minimum SEVERE
 * The ML score may never suppress a strong verified rainfall safety signal.
 */

export const THRESHOLD_I0_MM_PER_DAY = 43.26;
export const THRESHOLD_EXPONENT = -0.78;
export const SUPPORTED_DURATIONS_DAYS = [1, 3, 5, 7] as const;

export type ThresholdBand = 'below' | 'approached' | 'strong' | 'extreme';
export type SafetyLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export const THRESHOLD_CITATION =
  'Regional Sikkim threshold: I = 43.26 × D^-0.78 (mm/day)';

export interface DurationThresholdEvaluation {
  duration_days: number;
  /** cumulative rainfall observed over the window (mm) */
  observed_cumulative_mm: number;
  /** observed mean intensity over the window (mm/day) */
  observed_intensity: number;
  /** cumulative threshold for this duration (mm) */
  threshold_cumulative_mm: number;
  /** threshold intensity for this duration (mm/day) */
  threshold_intensity_mm_per_day: number;
  ratio: number;
  band: ThresholdBand;
  /** false when the driving rainfall window had no observation coverage */
  evaluated: boolean;
}

export interface ThresholdEvaluation {
  exceeded: boolean;
  max_ratio: number | null;
  critical_duration_days: number | null;
  safety_level: SafetyLevel;
  durations: DurationThresholdEvaluation[];
  citation: string;
  /** provenance class of the driving rainfall observations */
  rainfall_provenance: 'REAL' | 'DERIVED' | 'SYNTHETIC';
  source_id: string;
}

/** Cumulative rainfall threshold (mm) for a duration in days. */
export function cumulativeThresholdMm(durationDays: number): number {
  const intensity = THRESHOLD_I0_MM_PER_DAY * Math.pow(durationDays, THRESHOLD_EXPONENT);
  return Math.round(intensity * durationDays * 1000) / 1000;
}

/** Threshold intensity (mm/day) for a duration in days. */
export function thresholdIntensityMmPerDay(durationDays: number): number {
  return Math.round(THRESHOLD_I0_MM_PER_DAY * Math.pow(durationDays, THRESHOLD_EXPONENT) * 1000) / 1000;
}

export function classifyBand(ratio: number): ThresholdBand {
  if (ratio >= 2.0) return 'extreme';
  if (ratio >= 1.3) return 'strong';
  if (ratio >= 1.0) return 'approached';
  return 'below';
}

/**
 * Safety floor level for a threshold ratio (spec §8.2 prototype):
 *   >= 2.0 → SEVERE, >= 1.3 → HIGH, >= 1.0 → MODERATE, else LOW.
 */
export function safetyLevelForRatio(ratio: number): SafetyLevel {
  if (ratio >= 2.0) return 'SEVERE';
  if (ratio >= 1.3) return 'HIGH';
  if (ratio >= 1.0) return 'MODERATE';
  return 'LOW';
}

export interface DurationRainfall {
  rainfall_24h?: number | null;
  rainfall_3d?: number | null;
  rainfall_5d?: number | null;
  rainfall_7d?: number | null;
}

const RAINFALL_BY_DURATION: Record<number, keyof DurationRainfall> = {
  1: 'rainfall_24h',
  3: 'rainfall_3d',
  5: 'rainfall_5d',
  7: 'rainfall_7d',
};

/**
 * Evaluate the rainfall threshold for all supported durations.
 * A duration is `evaluated: false` when its rainfall window is null/missing —
 * missing windows are never treated as zero rainfall.
 */
export function evaluateRainfallThreshold(
  rainfall: DurationRainfall,
  opts: { rainfall_provenance?: 'REAL' | 'DERIVED' | 'SYNTHETIC'; source_id?: string } = {}
): ThresholdEvaluation {
  const durations: DurationThresholdEvaluation[] = SUPPORTED_DURATIONS_DAYS.map((d) => {
    const key = RAINFALL_BY_DURATION[d];
    const raw = rainfall[key];
    const hasValue = typeof raw === 'number' && Number.isFinite(raw);
    const observedCumulative = hasValue ? Math.max(0, raw as number) : 0;
    const observedIntensity = hasValue ? observedCumulative / d : 0;
    const thresholdCum = cumulativeThresholdMm(d);
    const ratio =
      hasValue && thresholdCum > 0
        ? Math.round((observedCumulative / thresholdCum) * 1000) / 1000
        : 0;
    return {
      duration_days: d,
      observed_cumulative_mm: hasValue ? Math.round(observedCumulative * 100) / 100 : 0,
      observed_intensity: hasValue ? Math.round(observedIntensity * 1000) / 1000 : 0,
      threshold_cumulative_mm: thresholdCum,
      threshold_intensity_mm_per_day: thresholdIntensityMmPerDay(d),
      ratio,
      band: classifyBand(ratio),
      evaluated: hasValue,
    };
  });

  const evaluated = durations.filter((x) => x.evaluated);
  let max: DurationThresholdEvaluation | null = null;
  for (const x of evaluated) {
    if (max === null || x.ratio > max.ratio) max = x;
  }

  return {
    exceeded: max !== null && max.ratio >= 1.0,
    max_ratio: max ? max.ratio : null,
    critical_duration_days: max ? max.duration_days : null,
    safety_level: max ? safetyLevelForRatio(max.ratio) : 'LOW',
    durations,
    citation: THRESHOLD_CITATION,
    rainfall_provenance: opts.rainfall_provenance ?? 'SYNTHETIC',
    source_id: opts.source_id ?? 'seed-telemetry',
  };
}

const LEVEL_ORDER: Record<SafetyLevel, number> = {
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
  SEVERE: 3,
};

/**
 * Safety floor: final_level = max(base_level, safety_level).
 * Returns the enforced level plus whether the floor escalated the base.
 */
export function applySafetyFloor(
  baseLevel: SafetyLevel,
  safetyLevel: SafetyLevel
): { final_level: SafetyLevel; escalated: boolean } {
  const finalLevel =
    LEVEL_ORDER[safetyLevel] > LEVEL_ORDER[baseLevel] ? safetyLevel : baseLevel;
  return { final_level: finalLevel, escalated: finalLevel !== baseLevel };
}

/**
 * Minimum risk index consistent with an enforced safety level
 * (kept in parity with riskEngine.composeHybridRisk floor scores).
 */
export function minimumScoreForLevel(level: SafetyLevel): number {
  switch (level) {
    case 'SEVERE': return 0.82;
    case 'HIGH': return 0.58;
    case 'MODERATE': return 0.32;
    default: return 0;
  }
}
