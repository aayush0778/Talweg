import React, { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import { fetchHistoricalEvents, replayHistoricalEventWithTimeline } from '../lib/apiClient';
import { PageShell, LoadingBlock, ErrorBlock } from '../components/page/PageShell';
import { RiskBadge } from '../components/RiskBadge';
import {
  HistoricalReplayListItem,
  HistoricalEventReplayResponse,
} from '../types/api';
import { CheckCircle2, AlertTriangle, FlaskConical } from 'lucide-react';

/**
 * Historical Replay page (Final Upgrade Spec §18)
 *
 * Event registry with explicit classification badges:
 *   REAL REPLAY · METHODOLOGY ONLY · SYNTHETIC SCENARIO
 * plus the T-7d → T-5d → T-3d → T-24h → EVENT timeline showing rainfall,
 * ARI, threshold ratio, model score, final risk and alert state per step.
 */

type ClassificationFilter = 'all' | 'real_replay' | 'methodology_only' | 'synthetic_demo';

const ReplayPage: React.FC = () => {
  const eventsQ = useApiResource(fetchHistoricalEvents, []);
  const [filter, setFilter] = useState<ClassificationFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replay, setReplay] = useState<HistoricalEventReplayResponse | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const events = eventsQ.data ?? [];
  const filtered = filter === 'all' ? events : events.filter((e) => classificationOf(e) === filter);

  const loadReplay = (id: string) => {
    setSelectedId(id);
    setReplayLoading(true);
    setReplayError(null);
    replayHistoricalEventWithTimeline(id)
      .then(setReplay)
      .catch((err) => setReplayError(err instanceof Error ? err.message : String(err)))
      .finally(() => setReplayLoading(false));
  };

  return (
    <PageShell
      title="Historical Replay"
      description="Replay verified historical landslide events through the risk engine. Replays are classified honestly: real environmental replay, methodology-only reconstruction, or synthetic scenario."
    >
      {/* Classification filter */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by replay classification">
        {(
          [
            ['all', 'All'],
            ['real_replay', 'Real replay'],
            ['methodology_only', 'Methodology only'],
            ['synthetic_demo', 'Synthetic scenario'],
          ] as [ClassificationFilter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-wider border ${
              filter === value
                ? 'bg-ink-800 text-paper-50 border-line-strong'
                : 'bg-ink-900 text-paper-400 border-line-subtle hover:text-paper-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Event registry */}
        <section className="xl:col-span-2 bg-ink-900 border border-line-subtle rounded-md" aria-label="Event registry">
          {eventsQ.loading && <div className="p-4"><LoadingBlock label="Loading events…" /></div>}
          {eventsQ.error && <div className="p-4"><ErrorBlock message={eventsQ.error.message} onRetry={eventsQ.reload} /></div>}
          {!eventsQ.loading && !eventsQ.error && (
            <ul className="divide-y divide-line-subtle max-h-[32rem] overflow-y-auto">
              {filtered.map((e) => {
                const cls = classificationOf(e);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => loadReplay(e.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-ink-800/60 transition-colors ${
                        selectedId === e.id ? 'bg-ink-800' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-paper-100 font-medium">
                          {e.event_date} · {e.zone_id ?? 'unknown zone'}
                        </span>
                        <ClassificationBadge status={cls} />
                      </div>
                      <p className="text-[10px] font-mono text-paper-400 mt-1 line-clamp-2">{e.source}</p>
                    </button>
                  </li>
                );
              })}
              {filtered.length === 0 && (
                <li className="px-4 py-6 text-center text-xs font-mono text-paper-400">No events in this classification.</li>
              )}
            </ul>
          )}
        </section>

        {/* Replay detail + timeline */}
        <section className="xl:col-span-3 space-y-4" aria-label="Replay detail" aria-live="polite">
          {!replay && !replayLoading && !replayError && (
            <div className="bg-ink-900 border border-dashed border-line-strong rounded-md p-10 text-center">
              <p className="text-xs font-mono text-paper-400">Select an event to run its replay.</p>
            </div>
          )}
          {replayLoading && <LoadingBlock label="Recomputing risk evolution…" />}
          {replayError && <ErrorBlock message={replayError} />}
          {replay && !replayLoading && (
            <>
              <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-paper-50">{replay.event.date} — {replay.event.category}</h2>
                    <ClassificationBadge status={replay.validation.status} />
                  </div>
                  <RiskBadge level={replay.talweg.risk_level} showDot={false} />
                </div>
                <p className="text-xs text-paper-300">{replay.event.description}</p>
                <p className="text-[10px] font-mono text-paper-400">{replay.validation.caveat}</p>
                <div className="flex flex-wrap gap-4 pt-1 text-xs">
                  <Metric label="Risk score" value={`${Math.round(replay.talweg.risk_score * 100)}/100`} />
                  <Metric label="Rainfall 24h" value={`${replay.inputs.rainfall_24h.value ?? '—'} mm`} />
                  <Metric label="Rainfall 3d" value={`${replay.inputs.rainfall_3d.value ?? '—'} mm`} />
                  <Metric label="Slope" value={`${replay.inputs.slope.value ?? '—'}°`} />
                </div>
              </div>

              {/* Timeline (spec §18: T-7d → Event) */}
              <div className="bg-ink-900 border border-line-subtle rounded-md overflow-hidden">
                <header className="px-4 py-3 border-b border-line-subtle">
                  <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Risk Evolution Timeline</h2>
                </header>
                <ol className="divide-y divide-line-subtle">
                  {replay.timeline.steps.map((step) => (
                    <li key={step.phase} className="px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-1.5">
                      <span className="w-16 text-xs font-mono font-semibold text-paper-100 shrink-0">{step.phase}</span>
                      <span className="text-xs text-paper-300 tabular-nums w-24">{step.date ?? `T-${step.days_before_event}d`}</span>
                      <Metric label="Rain (day)" value={`${step.daily_rainfall_mm} mm`} />
                      <Metric label="Cumulative" value={`${step.cumulative_rainfall_mm} mm`} />
                      <Metric label="ARI" value={String(step.antecedent_rainfall_index)} />
                      <Metric
                        label="Threshold"
                        value={step.threshold_ratio !== null ? `${step.threshold_ratio.toFixed(2)}×` : '—'}
                      />
                      <Metric label="Risk" value={`${Math.round(step.final_risk_index * 100)}`} />
                      <span className="ml-auto flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-paper-400">{step.alert_state}</span>
                        <RiskBadge level={step.risk_level} showDot={false} />
                      </span>
                    </li>
                  ))}
                </ol>
                <p className="px-4 py-2.5 text-[10px] font-mono text-paper-400 border-t border-line-subtle">
                  Reconstruction: {replay.timeline.reconstruction.replace(/_/g, ' ')} — {replay.timeline.methodology_note}
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
};

function classificationOf(e: HistoricalReplayListItem): 'real_replay' | 'methodology_only' | 'synthetic_demo' {
  if (e.data_quality === 'real_replay') return 'real_replay';
  if (e.data_quality === 'synthetic_demo') return 'synthetic_demo';
  return 'methodology_only';
}

const ClassificationBadge: React.FC<{ status: string }> = ({ status }) => {
  if (status === 'real_replay') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[#79c8a5]/50 bg-[#79c8a5]/10 text-[#79c8a5]">
        <CheckCircle2 size={11} aria-hidden="true" /> Real replay
      </span>
    );
  }
  if (status === 'synthetic_demo') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[#b5a0e6]/50 bg-[#b5a0e6]/10 text-[#b5a0e6]">
        <FlaskConical size={11} aria-hidden="true" /> Synthetic scenario
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-[#d8c56a]/50 bg-[#d8c56a]/10 text-[#d8c56a]">
      <AlertTriangle size={11} aria-hidden="true" /> Methodology only
    </span>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <span className="inline-flex items-baseline gap-1.5">
    <span className="text-[9px] font-mono uppercase tracking-wider text-paper-400">{label}</span>
    <span className="text-xs font-mono tabular-nums text-paper-100">{value}</span>
  </span>
);

export default ReplayPage;
