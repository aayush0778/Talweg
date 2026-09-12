/**
 * Model Registry Service (Final Upgrade Spec §15, §25)
 *
 * Single source of truth for model provenance surfaced on /api/model.
 * The frozen surrogate artifact is never retrained; its checksum is
 * verified via the ML service health payload.
 */

import { MODEL_VERSION, MODEL_ROLE, TRAINING_DATA_VERSION, ModelMode } from './hybridComposer';
import { config } from '../config';

export interface ModelInfoResponse {
  current_mode: {
    id: ModelMode | 'deterministic_engine';
    label: string;
    description: string;
  };
  ml_model: {
    type: string;
    version: string;
    role: string;
    is_probability: false;
    training_data: string;
    validation_status: string;
  };
  probability_display_allowed: false;
  artifact: {
    checksum_verified: boolean;
    artifact_hash: string | null;
    source: 'ml_service_health' | 'unavailable';
  };
  governance: {
    feature_schema_version: string;
    fallback_policy: string;
    promotion_policy: string;
  };
  pipeline: { stage: string; detail: string }[];
  ml_service_available: boolean;
  timestamp: string;
}

interface MlHealth {
  status?: string;
  model_loaded?: boolean;
  model_version?: string;
  artifact_hash?: string | null;
  training_data_version?: string | null;
  model_role?: string;
}

async function fetchMlHealth(timeoutMs = 900): Promise<MlHealth | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.mlServiceUrl}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as MlHealth;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function getModelInfo(featureSchemaVersion: string): Promise<ModelInfoResponse> {
  const mlHealth = await fetchMlHealth();
  const mode: ModelInfoResponse['current_mode'] =
    config.riskEngineMode === 'ml'
      ? {
          id: 'hybrid_prototype',
          label: 'Hybrid Prototype',
          description:
            'Synthetic surrogate model output composed with the deterministic rainfall-threshold safety engine. The safety floor can raise but never lower a rainfall-driven level.',
        }
      : {
          id: 'synthetic_surrogate',
          label: 'Synthetic Surrogate (deterministic engine)',
          description:
            'In-process deterministic prototype engine (ML composition disabled by configuration). Rainfall threshold safety rules are always evaluated.',
        };

  return {
    current_mode: mode,
    ml_model: {
      type: 'ExtraTreesRegressor',
      version: mlHealth?.model_version ?? MODEL_VERSION,
      role: mlHealth?.model_role ?? MODEL_ROLE,
      is_probability: false,
      training_data: mlHealth?.training_data_version ?? TRAINING_DATA_VERSION,
      validation_status: 'Synthetic approximation only (R² on synthetic function — not field accuracy)',
    },
    probability_display_allowed: false,
    artifact: {
      checksum_verified: Boolean(mlHealth?.artifact_hash),
      artifact_hash: mlHealth?.artifact_hash ?? null,
      source: mlHealth?.artifact_hash ? 'ml_service_health' : 'unavailable',
    },
    governance: {
      feature_schema_version: featureSchemaVersion,
      fallback_policy:
        'If the ML service is unavailable, the deterministic engine takes over with fallback_used=true and a fallback_reason. Fallback is always visible in API responses and the UI.',
      promotion_policy:
        'An empirical model may only replace the surrogate after real aligned event/non-event data passes leakage-safe benchmarking and documented acceptance criteria. The application never silently switches into empirical_model.',
    },
    pipeline: [
      { stage: 'Inputs', detail: 'Rainfall • Terrain • Soil • Moisture • Historical density (each with provenance)' },
      { stage: 'Feature builder', detail: 'Rolling windows, ARI (τ=3d), threshold ratios, quality gate' },
      { stage: 'Surrogate model', detail: 'Frozen ExtraTreesRegressor (synthetic function approximation)' },
      { stage: 'Threshold engine', detail: 'I = 43.26 × D^-0.78 (mm/day), D = 1/3/5/7 days' },
      { stage: 'Hybrid composer', detail: 'Safety floor: final level = max(model level, threshold safety level)' },
      { stage: 'Risk index', detail: 'Risk Index 0–100 with model mode + data quality metadata (never a probability)' },
    ],
    ml_service_available: Boolean(mlHealth?.model_loaded),
    timestamp: new Date().toISOString(),
  };
}
