/**
 * Historical Replay Timeline (Final Upgrade Spec §18)
 *
 * Builds the T-7d → T-5d → T-3d → T-24h → Event timeline for a replay record.
 * At each timestep: rainfall, ARI, threshold ratio, model score, final risk,
 * alert state.
 *
 * HONESTY: when only window aggregates exist (24h/3d/7d), the daily
 * distribution is a documented uniform reconstruction — the timeline carries
 * the record's own replay classification (REAL REPLAY / METHODOLOGY ONLY /
 * SYNTHETIC SCENARIO) so reconstructed environmental history can never be
 * presented as observed data.
 */

import { RiskInput, calculateRisk, RiskResult } from './riskEngine';
import { evaluateRainfallThreshold, applySafetyFloor, minimumScoreForLevel, SafetyLevel } from './rainfallThreshold';
import { calculateAriFromSeries } from './rainfallFeatures';

export type TimelinePhase = 'T-7d' | 'T-5d' | 'T-3d' | 'T-24h' | 'EVENT';

export interface ReplayTimelineStep {
  phase: TimelinePhase;
  /** days before the event (0 = event day) */
  days_before_event: number;
  date: string | null;
  /** reconstructed/observed rainfall for that single day (mm) */
  daily_rainfall_mm: number;
  /** cumulative rainfall up to and including this day (mm) */
  cumulative_rainfall_mm: number;
  antecedent_rainfall_index: number;
  threshold_ratio: number | null;
  critical_duration_days: number | null;
  model_score: number;
  final_risk_index: number;
  risk_level: SafetyLevel;
  alert_state: 'NONE' | 'WATCH' | 'HIGH' | 'SEVERE';
  note: string;
}

export interface ReplayTimeline {
  steps: ReplayTimelineStep[];
  reconstruction: 'observed_daily_series' | 'uniform_window_reconstruction';
  methodology_note: string;
}

const PHASES: { phase: TimelinePhase; daysBefore: number }[] = [
  { phase: 'T-7d', daysBefore: 6 },
  { phase: 'T-5d', daysBefore: 4 },
  { phase: 'T-3d', daysBefore: 2 },
  { phase: 'T-24h', daysBefore: 1 },
  { phase: 'EVENT', daysBefore: 0 },
];

function alertStateFor(level: SafetyLevel, ratio: number | null): ReplayTimelineStep['alert_state'] {
  if (ratio !== null && ratio >= 1.3) return level === 'SEVERE' ? 'SEVERE' : 'HIGH';
  if (ratio !== null && ratio >= 1.0) return 'WATCH';
  return level === 'SEVERE' || level === 'HIGH' ? 'WATCH' : 'NONE';
}

/**
 * Build the replay timeline for a record with window-aggregate rainfall.
 * Day 0 carries rainfall_24h; days 1–2 split (rainfall_3d − rainfall_24h);
 * days 3–6 split (rainfall_7d − rainfall_3d) uniformly.
 */
export function buildReplayTimeline(input: {
  rainfall_24h: number;
  rainfall_3d: number;
  rainfall_7d?: number | null;
  soil_moisture: number;
  slope: number;
  historical_density: number;
  event_date?: string | null;
}): ReplayTimeline {
  const r24 = Math.max(0, input.rainfall_24h ?? 0);
  const r3d = Math.max(0, input.rainfall_3d ?? 0);
  const r7d = Math.max(0, input.rainfall_7d ?? r3d);

  const daily: number[] = [];
  daily.push(r24);
  const earlyRest = Math.max(0, r3d - r24) / 2;
  daily.push(earlyRest, earlyRest);
  const lateRest = Math.max(0, r7d - r3d) / 4;
  daily.push(lateRest, lateRest, lateRest, lateRest);
  // daily[k] = k days before event (0 = event day)

  const eventDate = input.event_date ? new Date(input.event_date + 'T00:00:00Z') : null;

  const steps: ReplayTimelineStep[] = [];
  const series: { date: string; precip_mm: number }[] = [];

  // Walk forward in time order (T-7d first) accumulating series for ARI.
  const chronological = [...PHASES].sort((a, b) => b.daysBefore - a.daysBefore);
  const resultsByDaysBefore = new Map<number, ReplayTimelineStep>();

  for (const { phase, daysBefore } of chronological) {
    const dayRain = daily[daysBefore];
    series.push({ date: `day-${daysBefore}`, precip_mm: dayRain });

    // Cumulative rainfall up to AND INCLUDING this step only — days after
    // this step (closer to the event) are future information and must not
    // leak backward into the timeline (anti-leakage, spec §10.3).
    let cumulative = 0;
    for (let k = daysBefore; k < daily.length; k++) cumulative += daily[k];
    cumulative = Math.round(cumulative * 100) / 100;

    // windows relative to this step (days this-step-and-earlier only)
    let w3 = 0;
    for (let k = daysBefore; k < Math.min(daily.length, daysBefore + 3); k++) w3 += daily[k];
    let w7 = cumulative;

    const threshold = evaluateRainfallThreshold({
      rainfall_24h: daily[daysBefore],
      rainfall_3d: Math.round(w3 * 100) / 100,
      rainfall_7d: Math.round(w7 * 100) / 100,
    });
    const critical =
      threshold.critical_duration_days !== null
        ? threshold.durations.find((d) => d.duration_days === threshold.critical_duration_days)!
        : null;

    const riskInput: RiskInput = {
      rainfall_24h: daily[daysBefore],
      rainfall_3d: Math.round(w3 * 100) / 100,
      rainfall_7d: Math.round(w7 * 100) / 100,
      soil_moisture: input.soil_moisture,
      slope: input.slope,
      historical_density: input.historical_density,
    };
    const result: RiskResult = calculateRisk(riskInput);
    const { final_level, escalated } = applySafetyFloor(result.risk_level as SafetyLevel, threshold.safety_level);
    const finalScore = escalated
      ? Math.round(Math.max(result.risk_score, minimumScoreForLevel(threshold.safety_level)) * 1000) / 1000
      : result.risk_score;

    const ari = calculateAriFromSeries(series.map((s, idx) => ({
      date: `2000-01-${String(idx + 1).padStart(2, '0')}`,
      precip_mm: s.precip_mm,
    })));

    const dateIso =
      eventDate && !Number.isNaN(eventDate.getTime())
        ? new Date(eventDate.getTime() - daysBefore * 86_400_000).toISOString().slice(0, 10)
        : null;

    const step: ReplayTimelineStep = {
      phase,
      days_before_event: daysBefore,
      date: dateIso,
      daily_rainfall_mm: Math.round(dayRain * 100) / 100,
      cumulative_rainfall_mm: cumulative,
      antecedent_rainfall_index: ari ?? 0,
      threshold_ratio: critical ? critical.ratio : null,
      critical_duration_days: critical ? critical.duration_days : null,
      model_score: result.risk_score,
      final_risk_index: finalScore,
      risk_level: final_level,
      alert_state: alertStateFor(final_level, critical ? critical.ratio : null),
      note:
        escalated
          ? `Rainfall safety floor enforced (${threshold.safety_level})`
          : 'Deterministic engine assessment',
    };
    resultsByDaysBefore.set(daysBefore, step);
  }

  for (const { daysBefore } of PHASES) {
    steps.push(resultsByDaysBefore.get(daysBefore)!);
  }

  return {
    steps,
    reconstruction: 'uniform_window_reconstruction',
    methodology_note:
      'Daily values are a uniform reconstruction from verified window aggregates (24h/3d/7d). ' +
      'Threshold ratios, ARI and risk evolution follow the published regional threshold I = 43.26 × D^-0.78. ' +
      'This timeline preserves the replay record classification shown on the page.',
  };
}
