import { config } from '../config';
import { RiskInput, RiskResult, calculateRisk } from './riskEngine';
import { predictRiskWithMl } from './mlClient';

export interface EvaluateRiskOptions {
  mode?: 'deterministic' | 'ml';
  mlPredict?: (input: RiskInput) => Promise<RiskResult>;
}

/**
 * Unified Risk Evaluation Gateway with Resilient Fallback Seam.
 *
 * Mode 'ml': Queries the FastAPI surrogate microservice. If the microservice
 * fails (connection refused, 500 error, timeout), it logs a warning and
 * seamlessly falls back to the in-process deterministic risk engine with ZERO downtime.
 *
 * Mode 'deterministic': Evaluates directly via the in-process safety heuristic.
 *
 * Options parameter allows clean dependency injection for unit testing without global state mutation.
 */
export async function evaluateRisk(
  input: RiskInput,
  opts?: EvaluateRiskOptions
): Promise<RiskResult> {
  const mode = opts?.mode ?? config.riskEngineMode;
  const predictFn = opts?.mlPredict ?? predictRiskWithMl;

  if (mode === 'ml') {
    try {
      return await predictFn(input);
    } catch (err) {
      console.warn(
        `[risk-engine] ML service unavailable (${err instanceof Error ? err.message : err}), falling back to deterministic engine`
      );
      return calculateRisk(input);
    }
  }

  return calculateRisk(input);
}
