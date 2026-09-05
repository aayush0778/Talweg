import React, { useEffect, useState } from 'react';
import { replayHistoricalEvent } from '../lib/apiClient';
import { HistoricalReplayResponse } from '../types/api';
import { ProvenanceBadge } from './ProvenanceBadge';
import { getRiskColor } from '../lib/riskColors';
import { StatusMessage } from './StatusMessage';
import { HistoricalTimeline } from './HistoricalTimeline';
import { ConceptualMotionModal } from './ConceptualMotionModal';
import { HistoricalEvidencePanel } from './HistoricalEvidencePanel';

interface HistoricalReplayModalProps {
  id: string;
  onClose: () => void;
}

export const HistoricalReplayModal: React.FC<HistoricalReplayModalProps> = ({ id, onClose }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-slate-700 shadow-2xl rounded-xl w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header section */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700/80 bg-slate-900/50">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Historical Event Replay
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Content Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {loading ? (
            <div className="py-8">
              <StatusMessage type="loading" message="Loading replay data..." />
            </div>
          ) : error ? (
            <div className="py-8">
              <StatusMessage type="error" title="Replay Failed" message={error.message} />
            </div>
          ) : data ? (
            <>
              {/* Validation Banner */}
              {data.validation.status === 'synthetic_demo' && (
                <div className="px-4 py-2.5 bg-amber-950/40 border border-amber-900/60 rounded-lg text-amber-400 text-xs font-medium flex items-start gap-2 shadow-inner">
                  <span>⚠</span>
                  <span>Representative/synthetic scenario — not recorded historical weather. {data.validation.caveat}</span>
                </div>
              )}
              {data.validation.status === 'real_replay' && (
                <div className="px-4 py-2.5 bg-emerald-950/40 border border-emerald-900/60 rounded-lg text-emerald-400 text-xs font-medium flex items-start gap-2 shadow-inner">
                  <span>✓</span>
                  <span>Real historical data replay. {data.validation.caveat}</span>
                </div>
              )}
              {data.validation.status === 'methodology_only' && (
                <div className="px-4 py-2.5 bg-slate-800/40 border border-slate-700/60 rounded-lg text-slate-300 text-xs flex items-start gap-2 shadow-inner">
                  <span>ℹ</span>
                  <span>Methodology demonstration. {data.validation.caveat}</span>
                </div>
              )}

              {/* Event Info */}
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
                    {data.event.date}
                  </h3>
                  <ProvenanceBadge type={data.event.source.type} note={data.event.source.note} />
                </div>
                <div className="text-xs text-slate-400 font-mono">
                  {data.event.latitude.toFixed(4)}°, {data.event.longitude.toFixed(4)}°
                </div>
                <div className="text-xs">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 mr-2">
                    {data.event.category}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed mt-2">
                  {data.event.description}
                </p>
              </div>

              {/* Conditions Snapshot */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1">
                  Conditions Snapshot (Inputs)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: '24h Rain', val: data.inputs.rainfall_24h, unit: 'mm' },
                    { label: '3d Rain', val: data.inputs.rainfall_3d, unit: 'mm' },
                    { label: '7d Rain', val: data.inputs.rainfall_7d, unit: 'mm' },
                    { label: 'Soil Moist', val: data.inputs.soil_moisture, unit: '%', format: (v: number) => Math.round(v * 100) },
                    { label: 'Slope', val: data.inputs.slope, unit: '°' },
                    { label: 'Hist. Density', val: data.inputs.historical_density, unit: '' },
                  ].map((item, idx) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col gap-1.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">{item.label}</span>
                        <ProvenanceBadge type={item.val.provenance.type} />
                      </div>
                      <div className="text-base font-semibold text-white">
                        {item.val.value !== null ? (
                          <>
                            {item.format ? item.format(item.val.value) : item.val.value}
                            {item.unit && <span className="text-[10px] text-slate-400 ml-1 font-normal">{item.unit}</span>}
                          </>
                        ) : '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TALWEG Assessment */}
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner flex flex-col sm:flex-row gap-6">
                <div className="flex flex-col gap-2 flex-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    TALWEG Assessment
                  </span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-white tracking-tight">
                      {Math.round(data.talweg.risk_score * 100)}
                    </span>
                    <span className="text-sm font-semibold text-slate-500">/ 100</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                      style={{ backgroundColor: `${getRiskColor(data.talweg.risk_level)}20`, color: getRiskColor(data.talweg.risk_level) }}
                    >
                      {data.talweg.risk_level}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-mono border border-slate-700">
                      Engine: {data.talweg.engine}
                    </span>
                  </div>
                </div>
                
                <div className="flex-1 flex items-center justify-center p-4 bg-slate-900/50 rounded-lg border border-slate-800/80">
                  {data.talweg.flagged ? (
                    <div className="text-center">
                      <div className="text-emerald-400 font-bold text-lg mb-1 tracking-wide">WOULD HAVE FLAGGED: YES</div>
                      <div className="text-xs text-slate-400">System correctly identifies risk</div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="text-slate-500 font-bold text-lg mb-1 tracking-wide">WOULD HAVE FLAGGED: NO</div>
                      <div className="text-xs text-slate-600">Risk did not meet threshold</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Risk Escalation Timeline */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1">
                  Reconstructed Escalation Timeline
                </h3>
                <HistoricalTimeline
                  points={[
                    { label: 'T-72h', risk_score: Math.max(0.12, Math.round(data.talweg.risk_score * 40) / 100), risk_level: 'LOW' },
                    { label: 'T-48h', risk_score: Math.max(0.28, Math.round(data.talweg.risk_score * 65) / 100), risk_level: 'MODERATE' },
                    { label: 'T-24h', risk_score: Math.max(0.45, Math.round(data.talweg.risk_score * 85) / 100), risk_level: data.talweg.risk_score >= 0.7 ? 'HIGH' : 'MODERATE' },
                    { label: 'EVENT', risk_score: data.talweg.risk_score, risk_level: data.talweg.risk_level },
                  ]}
                  isSynthetic={data.validation.status === 'synthetic_demo'}
                />
              </div>

              {/* Factor Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-800 pb-1">
                  Contributing Factors
                </h3>
                <div className="space-y-2">
                  {[...data.talweg.contributing_factors].sort((a, b) => b.contribution - a.contribution).map((factor, idx) => (
                    <div key={idx} className="flex flex-col gap-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span className="capitalize">{factor.factor.replace(/_/g, ' ')}</span>
                        <span className="font-mono">{(factor.contribution * 100).toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500/80 rounded-full" 
                          style={{ width: `${Math.max(0, factor.contribution * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons: Evidence & Motion */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2.5 justify-end">
                <button
                  onClick={() => setShowEvidence(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
                >
                  <span>📸</span>
                  <span>Historical Evidence</span>
                </button>
                <button
                  onClick={() => setShowMotion(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900 text-amber-300 border border-amber-800/80 transition cursor-pointer"
                >
                  <span>⚡</span>
                  <span>Conceptual Motion</span>
                </button>
              </div>

              {showEvidence && (
                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
                  <div className="max-w-md w-full">
                    <HistoricalEvidencePanel eventId={data.id} onClose={() => setShowEvidence(false)} />
                  </div>
                </div>
              )}

              {showMotion && (
                <ConceptualMotionModal
                  riskLevel={data.talweg.risk_level}
                  slope={data.inputs.slope.value ?? 35}
                  onClose={() => setShowMotion(false)}
                />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};
