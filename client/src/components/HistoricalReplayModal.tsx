import React, { useEffect, useState } from 'react';
import { X, TriangleAlert, CheckCircle2, Info } from 'lucide-react';
import { replayHistoricalEvent } from '../lib/apiClient';
import { HistoricalReplayResponse } from '../types/api';
import { ProvenanceBadge } from './ProvenanceBadge';
import { getRiskColor } from '../lib/riskColors';
import { PanelLoading, PanelError } from './PanelStates';
import { HistoricalTimeline } from './HistoricalTimeline';
import { ConceptualMotionModal } from './ConceptualMotionModal';
import { HistoricalEvidencePanel } from './HistoricalEvidencePanel';

interface HistoricalReplayModalProps {
  id: string;
  onClose: () => void;
  onLaunchProgression?: (replayId: string) => void;
}

export const HistoricalReplayModal: React.FC<HistoricalReplayModalProps> = ({
  id,
  onClose,
  onLaunchProgression,
}) => {
  const [data, setData] = useState<HistoricalReplayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [showMotion, setShowMotion] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    replayHistoricalEvent(id)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Historical Event Replay"
    >
      <div className="bg-ink-900 border border-line-strong shadow-drawer rounded-xl w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden text-paper-200">
        {/* Header section */}
        <div className="flex items-center justify-between p-4 border-b border-line-subtle bg-ink-950/60">
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-paper-50 flex items-center gap-2">
            Historical Incident Replay
          </h2>
          <button
            onClick={onClose}
            className="text-paper-400 hover:text-paper-100 p-1 rounded hover:bg-ink-800 transition-colors cursor-pointer"
            title="Close dialog"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="py-8">
              <PanelLoading message="Reconstructing historical inputs..." />
            </div>
          ) : error ? (
            <div className="py-8">
              <PanelError title="Replay Failed" message={error.message} />
            </div>
          ) : data ? (
            <>
              {/* Validation Banner */}
              {data.validation.status === 'synthetic_demo' && (
                <div className="px-3.5 py-2.5 bg-silt-900/40 border border-silt-700/60 rounded-md text-silt-300 text-xs flex items-start gap-2">
                  <TriangleAlert className="w-4 h-4 shrink-0 text-silt-400 mt-0.5" aria-hidden="true" />
                  <span>Representative scenario — not recorded historical weather. {data.validation.caveat}</span>
                </div>
              )}
              {data.validation.status === 'real_replay' && (
                <div className="px-3.5 py-2.5 bg-lichen-950/40 border border-lichen-700/60 rounded-md text-lichen-300 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-lichen-400 mt-0.5" aria-hidden="true" />
                  <span>Real historical data replay. {data.validation.caveat}</span>
                </div>
              )}
              {data.validation.status === 'methodology_only' && (
                <div className="px-3.5 py-2.5 bg-ink-950/60 border border-line-subtle rounded-md text-paper-300 text-xs flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 text-paper-400 mt-0.5" aria-hidden="true" />
                  <span>Methodology demonstration. {data.validation.caveat}</span>
                </div>
              )}

              {/* Event Info */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono font-semibold text-paper-400 uppercase tracking-wider">
                    Incident Parameters
                  </h3>
                  <ProvenanceBadge type={data.event.source.type} note={data.event.source.note} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="p-2.5 rounded bg-ink-950/70 border border-line-subtle">
                    <span className="text-paper-400 block text-[10px] font-mono">Date</span>
                    <span className="font-mono text-paper-100">{data.event.date}</span>
                  </div>
                  <div className="p-2.5 rounded bg-ink-950/70 border border-line-subtle">
                    <span className="text-paper-400 block text-[10px] font-mono">Classification</span>
                    <span className="font-mono text-paper-100">{data.event.category}</span>
                  </div>
                </div>
                {data.event.description && (
                  <p className="text-xs text-paper-300 leading-normal pt-1">{data.event.description}</p>
                )}
              </div>

              {/* Conditions Snapshot */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-mono font-semibold text-paper-400 uppercase tracking-wider">
                  Reconstructed Environmental Inputs
                </h3>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded bg-ink-950/70 border border-line-subtle text-center">
                    <span className="text-paper-400 block text-[10px] font-mono">24h Rain</span>
                    <span className="font-mono font-bold text-paper-50 tabular-nums">
                      {data.inputs.rainfall_24h.value ?? '—'} mm
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-ink-950/70 border border-line-subtle text-center">
                    <span className="text-paper-400 block text-[10px] font-mono">3d Rain</span>
                    <span className="font-mono font-bold text-paper-50 tabular-nums">
                      {data.inputs.rainfall_3d.value ?? '—'} mm
                    </span>
                  </div>
                  <div className="p-2.5 rounded bg-ink-950/70 border border-line-subtle text-center">
                    <span className="text-paper-400 block text-[10px] font-mono">Soil Saturation</span>
                    <span className="font-mono font-bold text-paper-50 tabular-nums">
                      {data.inputs.soil_moisture.value !== null
                        ? `${Math.round(data.inputs.soil_moisture.value * 100)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Assessment Card */}
              <div className="p-4 rounded-lg bg-ink-950 border border-line-strong space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-400">
                    TALWEG Assessment at Event Time
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono border bg-ink-900 border-line-subtle text-paper-300">
                    {data.talweg.engine === 'hybrid'
                      ? 'Hybrid Safety Floor'
                      : data.talweg.engine === 'ml'
                      ? 'ML Surrogate'
                      : 'Deterministic'}
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span
                    className="text-3xl font-mono font-bold tabular-nums"
                    style={{ color: getRiskColor(data.talweg.risk_level) }}
                  >
                    {(data.talweg.risk_score * 100).toFixed(0)}
                  </span>
                  <span className="text-xs font-mono text-paper-400">/ 100 index</span>
                  <span className="text-xs font-mono font-bold text-paper-100 uppercase">
                    {data.talweg.risk_level} TIER
                  </span>
                  <span
                    className={`ml-auto text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                      data.talweg.flagged
                        ? 'bg-lichen-700/20 text-lichen-300 border-lichen-600/40'
                        : 'bg-ink-800 text-paper-400 border-line-subtle'
                    }`}
                  >
                    WOULD HAVE FLAGGED: {data.talweg.flagged ? 'YES' : 'NO'}
                  </span>
                </div>
              </div>

              {/* Escalation Timeline */}
              <HistoricalTimeline
                points={[
                  { label: 'T-72h', risk_score: Math.max(0.15, data.talweg.risk_score * 0.4), risk_level: 'LOW' },
                  { label: 'T-48h', risk_score: Math.max(0.25, data.talweg.risk_score * 0.65), risk_level: 'MODERATE' },
                  { label: 'T-24h', risk_score: Math.max(0.45, data.talweg.risk_score * 0.85), risk_level: 'HIGH' },
                  { label: 'EVENT', risk_score: data.talweg.risk_score, risk_level: data.talweg.risk_level },
                ]}
                isSynthetic={data.validation.status === 'synthetic_demo'}
              />

              {/* Replay Actions */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowMotion(true)}
                  className="flex-1 py-2 px-3 rounded-md bg-ink-800 hover:bg-ink-700 text-paper-200 border border-line-strong text-xs font-mono font-medium transition cursor-pointer"
                >
                  Conceptual Motion
                </button>
                <button
                  onClick={() => setShowEvidence(true)}
                  className="flex-1 py-2 px-3 rounded-md bg-ink-800 hover:bg-ink-700 text-paper-200 border border-line-strong text-xs font-mono font-medium transition cursor-pointer"
                >
                  Evidence Archive
                </button>
                {onLaunchProgression && (
                  <button
                    onClick={() => {
                      onClose();
                      onLaunchProgression(id);
                    }}
                    className="flex-1 py-2 px-3 rounded-md bg-lichen-500 hover:bg-lichen-400 text-ink-950 text-xs font-mono font-bold transition cursor-pointer"
                  >
                    Runout Simulation
                  </button>
                )}
              </div>

              {showMotion && (
                <ConceptualMotionModal
                  riskLevel={data.talweg.risk_level}
                  slope={data.inputs.slope.value ?? 35}
                  onClose={() => setShowMotion(false)}
                />
              )}

              {showEvidence && (
                <HistoricalEvidencePanel
                  eventId={data.event.description || id}
                  onClose={() => setShowEvidence(false)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
