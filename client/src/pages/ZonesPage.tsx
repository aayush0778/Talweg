import React, { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchRiskZones, fetchZoneFeatures, fetchZoneRisk } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock, RiskIndex, ModelModeBadge } from '../components/page/PageShell';
import { RiskBadge } from '../components/RiskBadge';
import { RiskZone, FeatureRecord, ZoneRiskResponse } from '../types/api';
import { ChevronRight } from 'lucide-react';

/**
 * Zones page (Final Upgrade Spec §22.1, §23)
 *
 * Zone registry with explainable detail: risk index, level, top signals,
 * rainfall/threshold evidence, terrain, soil (with provenance), historical
 * density, data freshness and model mode. Answers "Why is this zone HIGH?"
 */

const ZonesPage: React.FC = () => {
  const zonesQ = useApiResource(fetchRiskZones, []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const zones = zonesQ.data ?? [];
  const selected = zones.find((z) => z.id === selectedId) ?? null;

  return (
    <PageShell
      title="Zones"
      description="Monitored Sikkim risk zones with explainable risk assessment. Every value carries its data provenance — synthetic, derived and real values remain distinguishable."
    >
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <section className="xl:col-span-2 bg-ink-900 border border-line-subtle rounded-md" aria-label="Zone list">
          {zonesQ.loading && <div className="p-4"><LoadingBlock label="Loading zones…" /></div>}
          {zonesQ.error && <div className="p-4"><ErrorBlock message={zonesQ.error.message} onRetry={zonesQ.reload} /></div>}
          {!zonesQ.loading && !zonesQ.error && (
            <ul className="divide-y divide-line-subtle">
              {zones.map((z) => (
                <li key={z.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(z.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-ink-800/60 transition-colors ${selectedId === z.id ? 'bg-ink-800' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-paper-100 truncate">{z.name}</p>
                      <p className="text-[10px] font-mono text-paper-400 truncate">
                        {z.timestamp ? `obs ${new Date(z.timestamp).toLocaleDateString()}` : 'no observation'} · {z.data_source ?? 'unknown'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <RiskIndex score={z.risk_score} />
                      <RiskBadge level={z.risk_level} showDot={false} />
                      <ChevronRight size={14} className="text-paper-400" aria-hidden="true" />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="xl:col-span-3" aria-label="Zone detail" aria-live="polite">
          {!selected ? (
            <div className="bg-ink-900 border border-dashed border-line-strong rounded-md p-10 text-center">
              <p className="text-xs font-mono text-paper-400">Select a zone for its explainable risk assessment.</p>
            </div>
          ) : (
            <ZoneDetailPanel zone={selected} />
          )}
        </section>
      </div>
    </PageShell>
  );
};

const ZoneDetailPanel: React.FC<{ zone: RiskZone }> = ({ zone }) => {
  const riskQ = useApiResource(() => fetchZoneRisk(zone.id), [zone.id]);
  const featuresQ = useApiResource(() => fetchZoneFeatures(zone.id), [zone.id]);

  const risk = riskQ.data;
  const features: FeatureRecord | null = featuresQ.data;

  return (
    <div className="space-y-4">
      {/* Header (spec §23) */}
      <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-paper-50">{zone.name}</h2>
          <div className="flex items-center gap-2">
            <ModelModeBadge mode={risk?.model_mode} />
            <RiskBadge level={risk?.risk_level ?? zone.risk_level} showDot />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <RiskIndex score={risk?.risk_index ?? zone.risk_score} size="lg" />
          {risk && (
            <p className="text-xs text-paper-300 max-w-xl">
              <span className="text-paper-400 font-mono uppercase text-[10px]">Why this level: </span>
              {explain(risk)}
            </p>
          )}
        </div>
        {risk?.uncertainty.domain_warning && (
          <p className="text-[11px] font-mono text-[#d8c56a]">
            Domain warning: {risk.uncertainty.message} clamped: {risk.uncertainty.clamped_features.join(', ')}
          </p>
        )}
      </div>

      {riskQ.loading && <LoadingBlock label="Computing zone risk…" />}
      {riskQ.error && <ErrorBlock message={riskQ.error.message} onRetry={riskQ.reload} />}

      {risk && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Rainfall + threshold evidence */}
          <EvidenceCard title="Rainfall & Threshold">
            <Row label="Antecedent Rainfall Index" value={risk.antecedent_rainfall_index != null ? `${risk.antecedent_rainfall_index} mm (index)` : '—'} />
            {risk.rainfall_threshold.evaluation.durations.map((d) => (
              <Row
                key={d.duration_days}
                label={`${d.duration_days}-day rainfall`}
                value={
                  d.evaluated
                    ? `${d.observed_cumulative_mm} mm · ${d.ratio.toFixed(2)}× ${d.band}`
                    : 'no coverage'
                }
                highlight={d.evaluated && d.ratio >= 1}
              />
            ))}
            <p className="text-[10px] font-mono text-paper-400 pt-1">{risk.rainfall_threshold.evaluation.citation}</p>
          </EvidenceCard>

          {/* Deterministic signals (§24: separate from model attribution) */}
          <EvidenceCard title="Deterministic Signal Contribution">
            {risk.triggered_rules.map((r) => (
              <div key={r.rule} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-paper-200">{r.rule.replace(/_/g, ' ')}</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-paper-400">{r.detail}</span>
                  <RiskBadge level={r.status} showDot={false} />
                </span>
              </div>
            ))}
          </EvidenceCard>
        </div>
      )}

      {/* Feature family panel with provenance (§4.1, §5.4, §13) */}
      {featuresQ.loading && <LoadingBlock label="Loading feature record…" />}
      {featuresQ.error && <ErrorBlock message={featuresQ.error.message} onRetry={featuresQ.reload} />}
      {features && (
        <div className="bg-ink-900 border border-line-subtle rounded-md overflow-hidden">
          <header className="px-4 py-3 border-b border-line-subtle flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Feature Record</h3>
            <div className="flex items-center gap-2 text-[10px] font-mono text-paper-400">
              <span>completeness {Math.round(features.completeness * 100)}%</span>
              <span>· alignment {features.alignment_status}</span>
              <span>· schema v{features.feature_schema_version}</span>
              {features.demo_fallback_mode && <span className="text-[#d8c56a]">· in-memory demo catalog</span>}
            </div>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-paper-400 border-b border-line-subtle">
                  <th scope="col" className="px-4 py-2">Feature</th>
                  <th scope="col" className="px-4 py-2">Value</th>
                  <th scope="col" className="px-4 py-2">Unit</th>
                  <th scope="col" className="px-4 py-2">Source</th>
                  <th scope="col" className="px-4 py-2">Provenance</th>
                  <th scope="col" className="px-4 py-2">Quality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {Object.entries(features.features).map(([key, fv]) =>
                  fv ? (
                    <tr key={key}>
                      <td className="px-4 py-1.5 text-paper-100 font-mono text-[11px]">{key}</td>
                      <td className="px-4 py-1.5 text-paper-100 tabular-nums">
                        {fv.value === null ? <span className="text-paper-400">missing</span> : String(fv.value)}
                      </td>
                      <td className="px-4 py-1.5 text-paper-300 font-mono text-[10px]">{fv.unit}</td>
                      <td className="px-4 py-1.5 text-paper-300 font-mono text-[10px]">{fv.source_id}</td>
                      <td className="px-4 py-1.5">
                        <ProvenanceTag t={fv.provenance_type} />
                      </td>
                      <td className="px-4 py-1.5 text-paper-300 font-mono text-[10px]">{fv.quality_status}</td>
                    </tr>
                  ) : null
                )}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-[10px] font-mono text-paper-400 border-t border-line-subtle">
            `0` is an observed zero; `null` means missing. Values are never zero-filled.
          </p>
        </div>
      )}
    </div>
  );
};

const EvidenceCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
    <h3 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">{title}</h3>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const Row: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex items-center justify-between gap-2 text-xs">
    <span className="text-paper-400 font-mono text-[11px]">{label}</span>
    <span className={`font-mono tabular-nums ${highlight ? 'text-[#e49a62] font-semibold' : 'text-paper-100'}`}>{value}</span>
  </div>
);

const ProvenanceTag: React.FC<{ t: string }> = ({ t }) => {
  const cls =
    t === 'REAL'
      ? 'text-[#79c8a5] border-[#79c8a5]/40 bg-[#79c8a5]/10'
      : t === 'DERIVED'
        ? 'text-[#d8c56a] border-[#d8c56a]/40 bg-[#d8c56a]/10'
        : t === 'SYNTHETIC'
          ? 'text-[#b5a0e6] border-[#b5a0e6]/40 bg-[#b5a0e6]/10'
          : 'text-paper-400 border-line-strong bg-ink-800';
  return (
    <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-mono uppercase tracking-wider border ${cls}`}>{t}</span>
  );
};

function explain(risk: ZoneRiskResponse): string {
  const drivers = risk.deterministic.contributing_factors.slice(0, 3).map((f) => f.factor.replace(/_/g, ' '));
  const threshold = risk.rainfall_threshold;
  const parts: string[] = [];
  if (threshold.ratio !== null && threshold.ratio >= 1) {
    parts.push(`${threshold.duration_days}-day rainfall at ${threshold.ratio.toFixed(2)}× the regional threshold (${threshold.band})`);
  } else {
    parts.push('rainfall below regional threshold');
  }
  if (drivers.length > 0) parts.push(`top drivers: ${drivers.join(', ')}`);
  if (risk.rainfall_threshold.safety_level === risk.risk_level && threshold.ratio !== null && threshold.ratio >= 1.3) {
    parts.push('level enforced by rainfall safety floor');
  }
  return parts.join(' · ') + '.';
}

export default ZonesPage;
