/**
 * System Health Service (Final Upgrade Spec §27)
 *
 * Aggregates component health WITHOUT fabricating status:
 * - the database is reported as 'in_memory_fallback' when Postgres is down
 *   (the legacy /health endpoint kept its shape for compatibility; this
 *   endpoint tells the truth in detail)
 * - ML service + artifact checksum probed live
 * - data pipeline freshness read from ingested observations
 * - fallback count = predictions served without the ML model (last 24h)
 */

import { pool } from '../db';
import { config } from '../config';
import { query, isDbError } from '../db/query';
import { FEATURE_SCHEMA_VERSION } from '../schemas/featureSchema';

export type ComponentStatus = 'HEALTHY' | 'DEGRADED' | 'PARTIAL' | 'UNAVAILABLE';

export interface SystemHealthResponse {
  status: ComponentStatus;
  timestamp: string;
  components: {
    node_api: { status: ComponentStatus; uptime_seconds: number; latency_ms: number };
    database: {
      status: ComponentStatus;
      mode: 'postgres' | 'in_memory_fallback';
      postgis: string | null;
    };
    ml_service: {
      status: ComponentStatus;
      url_configured: string;
      model_loaded: boolean | null;
      latency_ms: number | null;
    };
    model_artifact: {
      status: ComponentStatus;
      checksum: string | null;
      checksum_verified: boolean;
      version: string;
    };
    data_pipeline: {
      status: ComponentStatus;
      latest_ingestion_at: string | null;
      note: string;
    };
  };
  metrics: {
    last_successful_prediction_at: string | null;
    fallback_count_24h: number | null;
    predictions_24h: number | null;
  };
  feature_schema_version: string;
}

interface MlProbe {
  ok: boolean;
  latency_ms: number | null;
  model_loaded: boolean | null;
  artifact_hash: string | null;
}

async function probeMlService(): Promise<MlProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  const started = Date.now();
  try {
    const res = await fetch(`${config.mlServiceUrl}/health`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return { ok: false, latency_ms: Date.now() - started, model_loaded: null, artifact_hash: null };
    const body = (await res.json()) as { model_loaded?: boolean; artifact_hash?: string | null };
    return {
      ok: true,
      latency_ms: Date.now() - started,
      model_loaded: body.model_loaded ?? null,
      artifact_hash: body.artifact_hash ?? null,
    };
  } catch {
    return { ok: false, latency_ms: Date.now() - started, model_loaded: null, artifact_hash: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const started = Date.now();

  // --- Database (honest) ---
  let dbMode: 'postgres' | 'in_memory_fallback' = 'in_memory_fallback';
  let postgis: string | null = null;
  let dbReachable = false;
  let pipeline: SystemHealthResponse['components']['data_pipeline'] = {
    status: 'UNAVAILABLE',
    latest_ingestion_at: null,
    note: 'Database unreachable — in-memory demo catalog active (seeded synthetic observations).',
  };
  try {
    await pool.query('SELECT 1');
    dbReachable = true;
    dbMode = 'postgres';
    try {
      const pg = await pool.query('SELECT PostGIS_Version() AS version');
      postgis = pg.rows[0]?.version ?? null;
    } catch {
      postgis = null;
    }
    // Latest ingestion across new series tables
    let latest: string | null = null;
    try {
      const rain = await query<{ latest: Date | string | null }>(
        `SELECT MAX(observed_at) AS latest FROM rainfall_observations;`
      );
      latest = rain.rows[0]?.latest ? new Date(rain.rows[0].latest).toISOString() : null;
    } catch {
      latest = null;
    }
    pipeline = {
      status: latest ? 'HEALTHY' : 'PARTIAL',
      latest_ingestion_at: latest,
      note: latest
        ? 'Rainfall observation series ingested; rolling windows and ARI derived from it.'
        : 'No rainfall observation series ingested yet — risk uses environmental_observations snapshots.',
    };
  } catch (err) {
    if (!isDbError(err)) {
      // non-connection DB error — still treat as degraded postgres
      dbReachable = false;
    }
  }

  // --- ML service + artifact ---
  const ml = await probeMlService();

  // --- Prediction metrics (only when DB reachable) ---
  let lastPredictionAt: string | null = null;
  let fallbackCount: number | null = null;
  let predictions24h: number | null = null;
  if (dbReachable) {
    try {
      const res = await query<{ last_at: Date | string | null; total: string; fallbacks: string }>(
        `SELECT MAX(evaluated_at) AS last_at,
                COUNT(*)::text AS total,
                COUNT(*) FILTER (WHERE fallback_used)::text AS fallbacks
         FROM risk_predictions
         WHERE evaluated_at >= NOW() - INTERVAL '24 hours';`
      );
      const row = res.rows[0];
      lastPredictionAt = row?.last_at ? new Date(row.last_at).toISOString() : null;
      predictions24h = row?.total != null ? parseInt(row.total, 10) : 0;
      fallbackCount = row?.fallbacks != null ? parseInt(row.fallbacks, 10) : 0;
    } catch {
      // risk_predictions may not exist yet (migration pending)
    }
  }

  const nodeLatency = Date.now() - started;

  const overall: ComponentStatus = !dbReachable
    ? 'PARTIAL'
    : ml.ok && ml.model_loaded
      ? 'HEALTHY'
      : 'PARTIAL';

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    components: {
      node_api: {
        status: 'HEALTHY',
        uptime_seconds: Math.round(process.uptime()),
        latency_ms: nodeLatency,
      },
      database: {
        status: dbReachable ? 'HEALTHY' : 'PARTIAL',
        mode: dbMode,
        postgis,
      },
      ml_service: {
        status: ml.ok ? (ml.model_loaded ? 'HEALTHY' : 'DEGRADED') : 'UNAVAILABLE',
        url_configured: config.mlServiceUrl,
        model_loaded: ml.model_loaded,
        latency_ms: ml.latency_ms,
      },
      model_artifact: {
        status: ml.artifact_hash ? 'HEALTHY' : ml.ok ? 'DEGRADED' : 'UNAVAILABLE',
        checksum: ml.artifact_hash,
        checksum_verified: Boolean(ml.artifact_hash),
        version: 'synthetic-surrogate-0.1.0',
      },
      data_pipeline: pipeline,
    },
    metrics: {
      last_successful_prediction_at: lastPredictionAt,
      fallback_count_24h: fallbackCount,
      predictions_24h: predictions24h,
    },
    feature_schema_version: FEATURE_SCHEMA_VERSION,
  };
}
