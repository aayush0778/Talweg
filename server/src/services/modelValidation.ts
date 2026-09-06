/**
 * Model Validation — Backtest Runner
 *
 * Runs the SAME deterministic risk engine used in production (calculateRisk
 * from riskEngine.ts — no re-implementation, no drift) against the 15
 * historical-event backtest scenarios, and reports how many would have been
 * flagged HIGH or SEVERE under representative trigger-day conditions.
 *
 * See backtestScenarios.ts for exactly what this does and does not validate.
 */

import { calculateRisk, RiskLevel } from './riskEngine';
import { BACKTEST_EVENTS, BacktestEvent } from './backtestScenarios';

export interface BacktestEventResult {
  id: string;
  date: string;
  zoneName: string;
  category: string;
  fatalities: number;
  description: string;
  predicted_risk_score: number;
  predicted_risk_level: RiskLevel;
  flagged: boolean; // true if predicted_risk_level is HIGH or SEVERE
}

export interface BacktestSummary {
  total_events: number;
  flagged_high_or_severe: number;
  flagged_pct: number;
  by_level: Record<RiskLevel, number>;
  methodology: string;
  caveat: string;
  results: BacktestEventResult[];
}

const FLAGGED_LEVELS: RiskLevel[] = ['HIGH', 'SEVERE'];

export function runModelValidationBacktest(): BacktestSummary {
  const results: BacktestEventResult[] = BACKTEST_EVENTS.map((event: BacktestEvent) => {
    const risk = calculateRisk(event.input);
    return {
      id: event.id,
      date: event.date,
      zoneName: event.zoneName,
      category: event.category,
      fatalities: event.fatalities,
      description: event.description,
      predicted_risk_score: risk.risk_score,
      predicted_risk_level: risk.risk_level,
      flagged: FLAGGED_LEVELS.includes(risk.risk_level),
    };
  });

  const by_level: Record<RiskLevel, number> = { LOW: 0, MODERATE: 0, HIGH: 0, SEVERE: 0 };
  for (const r of results) {
    by_level[r.predicted_risk_level] += 1;
  }

  const flagged = results.filter((r) => r.flagged).length;

  return {
    total_events: results.length,
    flagged_high_or_severe: flagged,
    flagged_pct: Math.round((flagged / results.length) * 1000) / 10,
    by_level,
    methodology:
      "Each of the 17 seeded historical events is assigned a representative trigger-day rainfall/soil-moisture snapshot based on its reported category and fatality count, then scored by the live deterministic risk engine (calculateRisk). 15 of these 17 are synthetic demo events (seed.sql); 2 are real, independently verifiable 2025 Sikkim landslides (see each event's citationSource in the raw event data) — though even for those 2, the quantitative trigger inputs remain a documented proxy, not measured historical weather.",
    caveat:
      "This validates the engine's threshold structure against representative trigger conditions, not actual recorded historical weather — no historical rainfall time-series is integrated yet, even for the 2 real verified events. 15 of the 17 underlying events are themselves synthetic demo data, not a real NASA/GLC import.",
    results,
  };
}
