import React from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchModelInfo, fetchModelValidation, fetchValidationSummary } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock, StatusPill } from '../components/page/PageShell';
import { ArrowDown } from 'lucide-react';

/**
 * Model page (Final Upgrade Spec §25)
 *
 * Surfaces the frozen model's provenance so technical judges can verify
 * every claim: current mode, model version, role, "Probability: NO",
 * training data, validation status, artifact checksum and the processing
 * pipeline — preventing technical ambiguity during evaluation.
 */

const ModelPage: React.FC = () => {
  const modelQ = useApiResource(fetchModelInfo, []);
  const backtestQ = useApiResource(fetchModelValidation, []);
  const summaryQ = useApiResource(fetchValidationSummary, []);
  const m = modelQ.data;

  return (
    <PageShell
      title="Model Provenance"
      description="The current ML artifact is deliberately frozen as a synthetic surrogate. TALWEG exposes that limitation honestly instead of presenting a synthetic score as a calibrated probability."
    >
      {modelQ.loading && <LoadingBlock label="Loading model registry…" />}
      {modelQ.error && <ErrorBlock message={modelQ.error.message} onRetry={modelQ.reload} />}

      {m && (
        <div className="space-y-4">
          {/* Current mode + model card */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2.5" aria-label="Current mode">
              <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Current Mode</h2>
              <p className="text-xl font-bold text-paper-50">{m.current_mode.label}</p>
              <p className="text-xs text-paper-300">{m.current_mode.description}</p>
              <div className="flex items-center gap-2 pt-1">
                <StatusPill status={m.ml_service_available ? 'HEALTHY' : 'UNAVAILABLE'} />
                <span className="text-[10px] font-mono text-paper-400">ML service {m.ml_service_available ? 'loaded' : 'unavailable — deterministic fallback active'}</span>
              </div>
            </section>

            <section className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2" aria-label="Model card">
              <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">ML Model</h2>
              <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-paper-400 font-mono">Model</dt>
                <dd className="text-paper-100">{m.ml_model.type}</dd>
                <dt className="text-paper-400 font-mono">Version</dt>
                <dd className="text-paper-100 font-mono">{m.ml_model.version}</dd>
                <dt className="text-paper-400 font-mono">Role</dt>
                <dd className="text-paper-100">{m.ml_model.role.replace(/_/g, ' ')}</dd>
                <dt className="text-paper-400 font-mono">Probability</dt>
                <dd className="text-[#ef7070] font-semibold">NO — Risk Index only</dd>
                <dt className="text-paper-400 font-mono">Training</dt>
                <dd className="text-paper-100 font-mono">{m.ml_model.training_data}</dd>
                <dt className="text-paper-400 font-mono">Validation</dt>
                <dd className="text-paper-100">{m.ml_model.validation_status}</dd>
                <dt className="text-paper-400 font-mono">Artifact</dt>
                <dd className="text-paper-100 font-mono break-all">
                  {m.artifact.checksum_verified ? 'checksum verified' : 'checksum unavailable'}
                  {m.artifact.artifact_hash && (
                    <span className="block text-[10px] text-paper-400">SHA-256 {m.artifact.artifact_hash.slice(0, 32)}…</span>
                  )}
                </dd>
              </dl>
            </section>
          </div>

          {/* Pipeline visual (spec §25) */}
          <section className="bg-ink-900 border border-line-subtle rounded-md p-4" aria-label="Processing pipeline">
            <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300 mb-3">Processing Pipeline</h2>
            <ol className="flex flex-col items-stretch">
              {m.pipeline.map((stage, i) => (
                <li key={stage.stage}>
                  <div className="bg-ink-800 border border-line-strong rounded-sm px-3.5 py-2.5">
                    <p className="text-xs font-semibold text-paper-50">{stage.stage}</p>
                    <p className="text-[10px] font-mono text-paper-400 mt-0.5">{stage.detail}</p>
                  </div>
                  {i < m.pipeline.length - 1 && (
                    <ArrowDown size={14} className="my-1 mx-auto text-paper-400" aria-hidden="true" />
                  )}
                </li>
              ))}
            </ol>
          </section>

          {/* Governance + validation */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2" aria-label="Governance">
              <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Governance</h2>
              <p className="text-xs text-paper-300"><span className="text-paper-400 font-mono">Feature schema:</span> {m.governance.feature_schema_version}</p>
              <p className="text-xs text-paper-300"><span className="text-paper-400 font-mono">Fallback policy:</span> {m.governance.fallback_policy}</p>
              <p className="text-xs text-paper-300"><span className="text-paper-400 font-mono">Promotion policy:</span> {m.governance.promotion_policy}</p>
            </section>

            <section className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2" aria-label="Prototype benchmark">
              <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">17-Event Prototype Benchmark</h2>
              <p className="text-[10px] font-mono text-[#d8c56a]">
                Synthetic replay of historical triggers — methodology demonstration, NOT detection accuracy.
              </p>
              {backtestQ.data && (
                <dl className="grid grid-cols-3 gap-2 text-xs">
                  <Metric label="Events" value={String(backtestQ.data.total_events)} />
                  <Metric label="Flagged HIGH+" value={String(backtestQ.data.flagged_high_or_severe)} />
                  <Metric label="Flag rate" value={`${Math.round(backtestQ.data.flagged_pct)}%`} />
                </dl>
              )}
              {summaryQ.data && (
                <p className="text-[10px] font-mono text-paper-400 pt-1">
                  Verified real replays: {summaryQ.data.real_replay_count} · synthetic: {summaryQ.data.synthetic_replay_count} · status: {summaryQ.data.status}
                  {summaryQ.data.reason ? ` — ${summaryQ.data.reason}` : ''}
                </p>
              )}
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-ink-800 border border-line-subtle rounded-sm px-2.5 py-2">
    <dt className="text-[9px] font-mono uppercase tracking-wider text-paper-400">{label}</dt>
    <dd className="text-sm font-mono tabular-nums text-paper-100">{value}</dd>
  </div>
);

export default ModelPage;
