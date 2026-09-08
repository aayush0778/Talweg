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
  model_version?: string;
  model_role?: string;
  is_probability?: boolean;
  data_quality_score?: number;
  uncertainty?: {
    in_domain: boolean;
    clamped_features: string[];
    domain_warning?: string | null;
  };
  fallback_used?: boolean;
  fallback_reason?: string | null;
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
    const payload: Record<string, unknown> = {
      rainfall_24h: input.rainfall_24h,
      rainfall_3d: input.rainfall_3d,
      soil_moisture: input.soil_moisture,
      slope: input.slope,
      historical_density: input.historical_density,
    };

    if (input.rainfall_5d !== undefined) payload.rainfall_5d = input.rainfall_5d;
    if (input.rainfall_7d !== undefined) payload.rainfall_7d = input.rainfall_7d;
    if (input.zone_id !== undefined) payload.zone_id = input.zone_id;
    if (input.latitude !== undefined) payload.latitude = input.latitude;
    if (input.longitude !== undefined) payload.longitude = input.longitude;

    const res = await fetch(`${config.mlServiceUrl}/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(payload),
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
      model_version: data.model_version || 'synthetic-surrogate-0.1.0',
      model_role: data.model_role || 'synthetic_function_approximation',
      is_probability: false,
      data_quality_score: data.data_quality_score ?? 1.0,
      uncertainty: data.uncertainty,
      fallback_used: false,
      fallback_reason: null,
      timestamp: data.timestamp || new Date().toISOString(),
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`ML service request timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
