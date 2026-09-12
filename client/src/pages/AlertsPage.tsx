import React from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchAlerts, fetchRiskZones } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock } from '../components/page/PageShell';
import { RiskBadge } from '../components/RiskBadge';
import { AlertResponse } from '../types/api';

/**
 * Alerts page (Final Upgrade Spec §19)
 *
 * Alerts carry operational meaning: zone, timestamp, risk level/index,
 * trigger, threshold ratio, evidence quality, recommended action, expiry
 * and alert ID.
 */

const AlertsPage: React.FC = () => {
  const alertsQ = useApiResource(() => fetchAlerts({ status: 'all' }), []);
  const zonesQ = useApiResource(fetchRiskZones, []);
  const [zoneFilter, setZoneFilter] = React.useState<string>('all');

  const alerts = alertsQ.data ?? [];
  const zones = zonesQ.data ?? [];
  const filtered = zoneFilter === 'all' ? alerts : alerts.filter((a) => a.zone_id === zoneFilter);
  const activeCount = alerts.filter((a) => a.status === 'active').length;

  return (
    <PageShell
      title="Alerts"
      description="Operational alert log. Each alert carries its trigger, threshold evidence, data-quality caveat, a recommended action and an expiry — alerts are decision support, not automated warnings."
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Zone</span>
          <select
            value={zoneFilter}
            onChange={(e) => setZoneFilter(e.target.value)}
            className="bg-ink-800 border border-line-strong rounded-sm px-2.5 py-2 text-sm text-paper-100"
          >
            <option value="all">All zones</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </label>
        <span className="text-[11px] font-mono text-paper-400">
          {filtered.length} alert{filtered.length === 1 ? '' : 's'} · {activeCount} active
        </span>
      </div>

      {alertsQ.loading && <LoadingBlock label="Loading alerts…" />}
      {alertsQ.error && <ErrorBlock message={alertsQ.error.message} onRetry={alertsQ.reload} />}

      {!alertsQ.loading && !alertsQ.error && (
        <ul className="space-y-3" aria-label="Alert list">
          {filtered.length === 0 && (
            <li className="bg-ink-900 border border-dashed border-line-strong rounded-md p-8 text-center text-xs font-mono text-paper-400">
              No alerts recorded for this filter.
            </li>
          )}
          {filtered.map((a) => (
            <AlertCard key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </PageShell>
  );
};

const AlertCard: React.FC<{ alert: AlertResponse }> = ({ alert: a }) => {
  const active = a.status === 'active';
  return (
    <li className={`bg-ink-900 border rounded-md p-4 space-y-2.5 ${active ? 'border-line-strong' : 'border-line-subtle opacity-75'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <RiskBadge level={a.severity} showDot={active} />
          <h2 className="text-sm font-semibold text-paper-50">{a.zone_name}</h2>
          <StatusBadge status={a.status} />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono text-paper-400">
          {a.alert_code && <span>{a.alert_code}</span>}
          <span>#{a.id}</span>
          <span>{new Date(a.created_at).toLocaleString()}</span>
        </div>
      </div>

      <p className="text-sm text-paper-200">{a.message}</p>

      <dl className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <Field label="Risk index" value={`${Math.round(a.risk_score * 100)}/100`} />
        <Field label="Threshold ratio" value={a.threshold_ratio != null ? `${a.threshold_ratio.toFixed(2)}×` : '—'} />
        <Field label="Evidence quality" value={a.evidence_quality != null ? `${Math.round(a.evidence_quality * 100)}%` : '—'} />
        <Field
          label="Expires"
          value={a.expires_at ? new Date(a.expires_at).toLocaleTimeString() : '—'}
        />
      </dl>

      {a.trigger_summary && (
        <p className="text-xs text-paper-300">
          <span className="text-[10px] font-mono uppercase tracking-wider text-paper-400">Primary trigger: </span>
          {a.trigger_summary}
        </p>
      )}
      {a.recommended_action && (
        <p className="text-xs text-[#d8c56a]">
          <span className="text-[10px] font-mono uppercase tracking-wider text-paper-400">Recommended action: </span>
          {a.recommended_action}
        </p>
      )}
    </li>
  );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border ${
      status === 'active'
        ? 'border-[#ef7070]/50 bg-[#ef7070]/10 text-[#ef7070]'
        : status === 'acknowledged'
          ? 'border-[#d8c56a]/50 bg-[#d8c56a]/10 text-[#d8c56a]'
          : 'border-line-subtle bg-ink-800 text-paper-400'
    }`}
  >
    {status}
  </span>
);

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-ink-800 border border-line-subtle rounded-sm px-2.5 py-1.5">
    <dt className="text-[9px] font-mono uppercase tracking-wider text-paper-400">{label}</dt>
    <dd className="text-xs font-mono tabular-nums text-paper-100">{value}</dd>
  </div>
);

export default AlertsPage;
