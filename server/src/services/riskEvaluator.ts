import { config } from '../config';
import {
  RiskInput,
  RiskResult,
  calculateRisk,
  calculateThresholdSignal,
  composeHybridRisk,
} from './riskEngine';
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
 * seamlessly falls back to the in-process deterministic risk engine with ZERO downtime
 * and explicit fallback metadata (fallback_used: true, fallback_reason).
 *
 * When the ML surrogate succeeds, the evaluator calculates the deterministic baseline
 * in parallel, computes ml_vs_deterministic_delta, checks literature rainfall
 * thresholds, and enforces the conservative safety floor.
 *
 * Mode 'deterministic': Evaluates directly via the in-process safety heuristic.
 */
export async function evaluateRisk(
  input: RiskInput,
  opts?: EvaluateRiskOptions
): Promise<RiskResult> {
  const mode = opts?.mode ?? config.riskEngineMode;
  const predictFn = opts?.mlPredict ?? predictRiskWithMl;
  const deterministicBaseline = calculateRisk(input);

  if (mode === 'ml') {
    try {
      const mlResult = await predictFn(input);
      const thresholdSignal = calculateThresholdSignal(
        input.rainfall_24h,
        input.rainfall_3d,
        input.rainfall_7d
      );

      const hybridResult = composeHybridRisk(mlResult, deterministicBaseline, thresholdSignal);
      // If safety override didn't trigger, preserve mlResult.engine for backward compatibility
      const finalEngine = hybridResult.safety_override ? 'hybrid' : (mlResult.engine || 'ml');

      return {
        ...hybridResult,
        engine: finalEngine,
        fallback_used: false,
        fallback_reason: null,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(
        `[risk-engine] ML service unavailable (${reason}), falling back to deterministic engine`
      );
      return {
        ...deterministicBaseline,
        fallback_used: true,
        fallback_reason: reason,
        ml_score: undefined,
        deterministic_score: deterministicBaseline.risk_score,
        ml_vs_deterministic_delta: null,
      };
    }
  }

  return {
    ...deterministicBaseline,
    fallback_used: false,
    fallback_reason: null,
    deterministic_score: deterministicBaseline.risk_score,
  };
}
