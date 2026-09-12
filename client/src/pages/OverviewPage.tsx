import React from 'react';
import { useApiResource } from '../hooks/useApiResource';
import {
  fetchRiskZones,
  fetchAlerts,
  fetchSystemHealth,
  fetchDataSources,
} from '../lib/apiClient';
import { PageShell, KpiCard, RiskIndex, StatusPill, ModelModeBadge, LoadingBlock, ErrorBlock } from '../components/page/PageShell';
import { RiskBadge } from '../components/RiskBadge';
import { RiskZone, AlertResponse, SystemHealthResponse, DataSourcesResponse } from '../types/api';
import { AlertTriangle, CloudRain, Layers, Clock, Cpu, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Overview Dashboard (Final Upgrade Spec §21)
 *
 * KPI cards (Active High/Severe Zones · Rainfall Alerts · Zones Monitored ·
 * Data Freshness · Model Mode) + central risk map summary + active alerts
 * + data quality / source status. Every number is derived from live API
 * state — nothing is hard-coded.
 */

function zoneCounts(zones: RiskZone[]) {
  const high = zones.filter((z) => z.risk_level === 'HIGH').length;
  const severe = zones.filter((z) => z.risk_level === 'SEVERE').length;
  return { high, severe, total: zones.length };
}

function alertsNeedingAttention(alerts: AlertResponse[]): AlertResponse[] {
  return alerts.filter((a) => a.status === 'active' && (a.severity === 'HIGH' || a.severity === 'SEVERE'));
}

const OverviewPage: React.FC = () => {
  const zonesQ = useApiResource(fetchRiskZones, []);
  const alertsQ = useApiResource(() => fetchAlerts({ status: 'active' }), []);
  const healthQ = useApiResource(fetchSystemHealth, []);
  const sourcesQ = useApiResource(fetchDataSources, []);

  const zones = zonesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const counts = zoneCounts(zones);
  const activeAlerts = alertsNeedingAttention(alerts);
  const health = healthQ.data;

  // Data freshness: age of the latest observation timestamp across zones
  const freshestObs = zones
    .map((z) => z.timestamp)
    .filter((t): t is string => Boolean(t))
    .sort()
    .pop();
  const freshnessLabel = freshestObs ? timeAgo(freshestObs) : '—';

  return (
    <PageShell
      title="Operations Overview"
      description="Sikkim landslide decision-support dashboard. Risk Index is a 0–100 decision-support score (model output) — it is not a probability of landslide occurrence."
      actions={<ModelModeBadge mode={health?.status ? 'hybrid_prototype' : null} />}
    >
      {/* KPI row (spec §21) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          label="High/Severe Zones"
          value={`${counts.high + counts.severe}`}
          sub={`${counts.severe} severe · ${counts.high} high`}
          tone={counts.severe > 0 ? 'severe' : counts.high > 0 ? 'high' : 'good'}
          icon={<AlertTriangle size={14} />}
        />
        <KpiCard
          label="Rainfall Alerts"
          value={`${activeAlerts.length}`}
          sub="active HIGH/SEVERE alerts"
          tone={activeAlerts.length > 0 ? 'high' : 'good'}
          icon={<CloudRain size={14} />}
        />
        <KpiCard
          label="Zones Monitored"
          value={`${counts.total}`}
          sub="Sikkim risk zones"
          icon={<Layers size={14} />}
        />
        <KpiCard
          label="Data Freshness"
          value={freshnessLabel}
          sub="latest zone observation"
          tone={health?.components.data_pipeline.status === 'HEALTHY' ? 'good' : 'warn'}
          icon={<Clock size={14} />}
        />
        <KpiCard
          label="Model Mode"
          value={health?.components.ml_service.status === 'HEALTHY' ? 'Hybrid' : 'Surrogate'}
          sub={
            health?.components.ml_service.status === 'HEALTHY'
              ? 'hybrid_prototype'
              : health
                ? 'synthetic_surrogate (fallback ready)'
                : '—'
          }
          icon={<Cpu size={14} />}
        />
      </div>

      {/* Middle row: risk board + active alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Zone risk board — links into the live map */}
        <section className="xl:col-span-2 bg-ink-900 border border-line-subtle rounded-md" aria-label="Current zone risk">
          <header className="px-4 py-3 border-b border-line-subtle flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Current Zone Risk</h2>
            <Link to="/map" className="text-[11px] font-mono uppercase tracking-wider text-paper-400 hover:text-paper-200 inline-flex items-center gap-1">
              Open Live Risk Map <ChevronRight size={12} />
            </Link>
          </header>
          {zonesQ.loading ? (
            <div className="p-4"><LoadingBlock label="Loading zones…" /></div>
          ) : zonesQ.error ? (
            <div className="p-4"><ErrorBlock message={zonesQ.error.message} onRetry={zonesQ.reload} /></div>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {[...zones]
                .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
                .slice(0, 6)
                .map((z) => (
                  <li key={z.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-paper-100 truncate">{z.name}</p>
                      <p className="text-[10px] font-mono text-paper-400 truncate">
                        {z.data_source ?? 'unknown source'} · {z.timestamp ? timeAgo(z.timestamp) : 'no timestamp'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <RiskIndex score={z.risk_score} />
                      <RiskBadge level={z.risk_level} showDot />
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Active alerts */}
        <section className="bg-ink-900 border border-line-subtle rounded-md" aria-label="Active alerts">
          <header className="px-4 py-3 border-b border-line-subtle flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Active Alerts</h2>
            <Link to="/alerts" className="text-[11px] font-mono uppercase tracking-wider text-paper-400 hover:text-paper-200 inline-flex items-center gap-1">
              All alerts <ChevronRight size={12} />
            </Link>
          </header>
          {alertsQ.loading ? (
            <div className="p-4"><LoadingBlock label="Loading alerts…" /></div>
          ) : alerts.length === 0 ? (
            <p className="p-4 text-xs font-mono text-paper-400">No active alerts. All monitored zones are below alert thresholds.</p>
          ) : (
            <ul className="divide-y divide-line-subtle">
              {alerts.slice(0, 5).map((a) => (
                <li key={a.id} className="px-4 py-2.5 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-paper-100 truncate">{a.zone_name}</span>
                    <RiskBadge level={a.severity} showDot={false} />
                  </div>
                  {a.trigger_summary && (
                    <p className="text-[10px] font-mono text-paper-400">{a.trigger_summary}</p>
                  )}
                  {a.recommended_action && (
                    <p className="text-[11px] text-paper-300 line-clamp-2">→ {a.recommended_action}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Data quality / source status (spec §21 bottom row) */}
      <DataQualityRow health={health} healthLoading={healthQ.loading} sources={sourcesQ.data} sourcesLoading={sourcesQ.loading} />
    </PageShell>
  );
};

const DataQualityRow: React.FC<{
  health: SystemHealthResponse | null;
  healthLoading: boolean;
  sources: DataSourcesResponse | null;
  sourcesLoading: boolean;
}> = ({ health, healthLoading, sources, sourcesLoading }) => (
  <section className="bg-ink-900 border border-line-subtle rounded-md" aria-label="Data quality and source status">
    <header className="px-4 py-3 border-b border-line-subtle flex items-center justify-between">
      <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Data Quality & Source Status</h2>
      <Link to="/data-sources" className="text-[11px] font-mono uppercase tracking-wider text-paper-400 hover:text-paper-200 inline-flex items-center gap-1">
        Data & Sources <ChevronRight size={12} />
      </Link>
    </header>
    {healthLoading || sourcesLoading ? (
      <div className="p-4"><LoadingBlock /></div>
    ) : (
      <div className="p-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {sources?.sources.slice(0, 5).map((s) => (
          <div key={s.id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-paper-200 truncate">{s.name}</span>
              <StatusPill status={s.status} />
            </div>
            <p className="text-[10px] font-mono text-paper-400">{s.provenance} · {s.temporal_resolution}</p>
          </div>
        ))}
        {health && (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-paper-200">Data Pipeline</span>
              <StatusPill status={health.components.data_pipeline.status} />
            </div>
            <p className="text-[10px] font-mono text-paper-400">
              {health.components.data_pipeline.latest_ingestion_at
                ? `ingested ${timeAgo(health.components.data_pipeline.latest_ingestion_at)}`
                : 'no series ingested'}
            </p>
          </div>
        )}
      </div>
    )}
  </section>
);

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default OverviewPage;
