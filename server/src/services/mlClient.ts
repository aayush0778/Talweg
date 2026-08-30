import { config } from '../config';
import { RiskInput, RiskResult } from './riskEngine';

export interface MlPredictResponse {
  risk_score: number;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  contributing_factors: {
    factor: string;
    raw: number;
    normalized: number;
    weight: number;
    contribution: number;
  }[];
  engine: 'ml';
  timestamp: string;
}

/**
 * Client for the internal Python FastAPI ML surrogate microservice.
 * Uses AbortController with configurable timeout (default 1000ms).
 * Throws on any failure so callers can seamlessly fall back to deterministic safety engine.
 */
export async function predictRiskWithMl(
  input: RiskInput,
  timeoutMs: number = config.mlTimeoutMs
): Promise<RiskResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${config.mlServiceUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        rainfall_24h: input.rainfall_24h,
        rainfall_3d: input.rainfall_3d,
        soil_moisture: input.soil_moisture,
        slope: input.slope,
        historical_density: input.historical_density,
      }),
    });

    if (!res.ok) {
      throw new Error(`ML service responded with HTTP ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as MlPredictResponse;

    if (
      typeof data.risk_score !== 'number' ||
      !data.risk_level ||
      !Array.isArray(data.contributing_factors)
    ) {
      throw new Error('Invalid response shape received from ML service');
    }

    return {
      risk_score: data.risk_score,
      risk_level: data.risk_level,
      contributing_factors: data.contributing_factors,
      engine: 'ml',
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
