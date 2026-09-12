import React from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchSystemHealth } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock, StatusPill } from '../components/page/PageShell';

/**
 * System Health page (Final Upgrade Spec §27)
 *
 * Honest component status: Node API, database (including in-memory fallback
 * mode), ML service, model artifact checksum, data pipeline freshness,
 * latency and fallback counts.
 */

const SystemHealthPage: React.FC = () => {
  const healthQ = useApiResource(fetchSystemHealth, []);
  const h = healthQ.data;

  return (
    <PageShell
      title="System Health"
      description="Live status of every platform component. When the database is offline the in-memory demo catalog is active and reported as such — status is never fabricated."
      actions={
        <button
          type="button"
          onClick={healthQ.reload}
          className="px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 hover:bg-ink-700"
        >
          Refresh
        </button>
      }
    >
      {healthQ.loading && <LoadingBlock label="Probing components…" />}
      {healthQ.error && <ErrorBlock message={healthQ.error.message} onRetry={healthQ.reload} />}

      {h && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <ComponentCard
              name="Node API"
              status={h.components.node_api.status}
              lines={[
                `uptime ${Math.floor(h.components.node_api.uptime_seconds / 60)}m`,
                `latency ${h.components.node_api.latency_ms} ms`,
              ]}
            />
            <ComponentCard
              name="Database"
              status={h.components.database.status}
              lines={[
                `mode: ${h.components.database.mode === 'postgres' ? 'PostgreSQL' : 'in-memory fallback (demo)'}`,
                h.components.database.postgis ? `PostGIS ${h.components.database.postgis.split(' ')[0]}` : 'PostGIS not detected',
              ]}
            />
            <ComponentCard
              name="ML Service"
              status={h.components.ml_service.status}
              lines={[
                h.components.ml_service.model_loaded ? 'surrogate model loaded' : 'model not loaded',
                h.components.ml_service.latency_ms != null ? `latency ${h.components.ml_service.latency_ms} ms` : 'unreachable',
              ]}
            />
            <ComponentCard
              name="Model Artifact"
              status={h.components.model_artifact.status}
              lines={[
                h.components.model_artifact.version,
                h.components.model_artifact.checksum_verified
                  ? `SHA-256 ${h.components.model_artifact.checksum?.slice(0, 24)}…`
                  : 'checksum unavailable',
              ]}
            />
            <ComponentCard
              name="Data Pipeline"
              status={h.components.data_pipeline.status}
              lines={[
                h.components.data_pipeline.latest_ingestion_at
                  ? `latest ingestion ${new Date(h.components.data_pipeline.latest_ingestion_at).toLocaleString()}`
                  : 'no rainfall series ingested',
                h.components.data_pipeline.note,
              ]}
            />
            <ComponentCard
              name="Prediction Metrics (24h)"
              status={h.metrics.predictions_24h != null ? 'HEALTHY' : 'UNAVAILABLE'}
              lines={[
                `predictions: ${h.metrics.predictions_24h ?? '—'}`,
                `fallbacks: ${h.metrics.fallback_count_24h ?? '—'}`,
                h.metrics.last_successful_prediction_at
                  ? `last: ${new Date(h.metrics.last_successful_prediction_at).toLocaleTimeString()}`
                  : 'no recent predictions',
              ]}
            />
          </div>

          <p className="text-[10px] font-mono text-paper-400">
            Feature schema {h.feature_schema_version} · overall status <span className="text-paper-100">{h.status}</span> · probed {new Date(h.timestamp).toLocaleTimeString()}
          </p>
        </div>
      )}
    </PageShell>
  );
};

const ComponentCard: React.FC<{
  name: string;
  status: string;
  lines: string[];
}> = ({ name, status, lines }) => (
  <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-xs font-semibold text-paper-50">{name}</h2>
      <StatusPill status={status} />
    </div>
    <ul className="space-y-0.5">
      {lines.filter(Boolean).map((line, i) => (
        <li key={i} className="text-[10px] font-mono text-paper-400 break-words">{line}</li>
      ))}
    </ul>
  </div>
);

export default SystemHealthPage;
