import React, { useState, useCallback } from 'react';
import { Database, CheckCircle2, TriangleAlert, FlaskConical, ChevronUp, ChevronDown } from 'lucide-react';
import type { HealthResponse, ModelValidationResponse, DataProvenance } from '../types/api';
import { fetchModelValidation } from '../lib/apiClient';
import { ProvenanceBadge } from './ProvenanceBadge';

interface DataSourcePanelProps {
  health: HealthResponse | null;
}

interface DataSource {
  name: string;
  type: DataProvenance;
  description: string;
  records: string;
  status: 'connected' | 'loaded' | 'demo';
}

const DATA_SOURCES: DataSource[] = [
  {
    name: 'Historical Incident Log',
    type: 'REAL',
    description: 'Official NASA Global Landslide Catalog (GLC) export filtered to Sikkim (lat 27.0–28.2°N, lon 88.0–89.0°E)',
    records: '82 verified NASA GLC events (+ 16 seed fixtures)',
    status: 'loaded',
  },
  {
    name: 'Zone Slope Values',
    type: 'DERIVED',
    description: 'SRTM 30m via opentopodata.org, finite-difference estimate at centroid and cardinal points',
    records: '6 zone base slopes',
    status: 'loaded',
  },
  {
    name: 'CHIRPS Rainfall',
    type: 'REAL',
    description: 'Official CHIRPS daily satellite precipitation retrieved via ClimateSERV API (NASA/USAID SERVIR) for Sikkim zones (~30–45d calibration latency)',
    records: '6 zone observations (July 25–31, 2026 satellite epoch)',
    status: 'loaded',
  },
  {
    name: 'Soil Moisture Estimate',
    type: 'SYNTHETIC',
    description: 'Representative antecedent saturation estimate — CHIRPS does not provide volumetric soil moisture telemetry',
    records: '6 zone estimates',
    status: 'demo',
  },
  {
    name: 'PostGIS Spatial Engine',
    type: 'REAL',
    description: 'PostgreSQL 16 + PostGIS 3.4 with GiST spatial indexes',
    records: 'Live connection',
    status: 'connected',
  },
  {
    name: 'ML Surrogate Model',
    type: 'DERIVED',
    description: 'ExtraTreesRegressor, R² > 0.998 on synthetic grid',
    records: 'Model loaded',
    status: 'loaded',
  },
  {
    name: 'ESRI World Imagery',
    type: 'REAL',
    description: 'Satellite basemap tiles via ArcGIS MapServer',
    records: 'Live tile stream',
    status: 'connected',
  },
];

const statusIndicator: Record<string, { color: string; label: string }> = {
  connected: { color: 'bg-lichen-400', label: 'Live' },
  loaded: { color: 'bg-monsoon-400', label: 'Loaded' },
  demo: { color: 'bg-silt-400', label: 'Demo' },
};

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({ health }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [validation, setValidation] = useState<ModelValidationResponse | null>(null);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next && !validation && !validationLoading) {
        setValidationLoading(true);
        setValidationError(null);
        fetchModelValidation()
          .then((data) => setValidation(data))
          .catch((err) => setValidationError(err instanceof Error ? err.message : 'Failed to load'))
          .finally(() => setValidationLoading(false));
      }
      return next;
    });
  }, [validation, validationLoading]);

  const isHealthy = health?.database === 'connected';

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-ink-900 border border-line-subtle text-paper-300 text-xs font-mono shadow-sm hover:bg-ink-800 hover:border-line-strong transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-lichen-400 animate-pulse" aria-hidden="true" />
        <span>DATA PIPELINE · MIXED</span>
        {isOpen ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      {isOpen && (
        <div className="absolute top-10 right-0 w-96 bg-ink-900/98 backdrop-blur-xl border border-line-strong rounded-lg shadow-2xl z-50 overflow-hidden text-paper-200">
          <div className="p-3 border-b border-line-subtle bg-ink-950/60">
            <div className="flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-lichen-400" aria-hidden="true" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-200">
                Pipeline & Provenance
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-paper-400 mt-1">
              {isHealthy ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-lichen-400" aria-hidden="true" />
                  <span>PostGIS operational ({health?.postgis ?? '3.x'})</span>
                </>
              ) : (
                <>
                  <TriangleAlert className="w-3 h-3 text-risk-severe" aria-hidden="true" />
                  <span>Database degraded</span>
                </>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line-subtle">
            {DATA_SOURCES.map((src) => {
              const status = statusIndicator[src.status];

              return (
                <div
                  key={src.name}
                  className="px-3 py-2.5 hover:bg-ink-800/40 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-paper-100">{src.name}</span>
                    <div className="flex items-center gap-2">
                      <ProvenanceBadge type={src.type} note={src.type === 'SYNTHETIC' ? 'Demo seed data' : undefined} />
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
                        <span className="text-[9px] font-mono text-paper-400">{status.label}</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-paper-400 leading-normal">{src.description}</p>
                  <p className="text-[10px] font-mono text-paper-300 mt-0.5">{src.records}</p>
                </div>
              );
            })}
          </div>

          <div className="p-3 border-t border-line-subtle bg-ink-950/60">
            <div className="flex items-center gap-1.5 mb-2">
              <FlaskConical className="w-3.5 h-3.5 text-paper-400" aria-hidden="true" />
              <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
                Model Validation
              </h3>
            </div>

            {validationLoading && (
              <p className="text-[10px] text-paper-400 font-mono">Running backtest against 17 historical events…</p>
            )}

            {validationError && (
              <p className="text-[10px] text-risk-severe font-mono">Could not load backtest: {validationError}</p>
            )}

            {validation && (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-mono font-bold text-lichen-400">
                    {validation.flagged_high_or_severe}/{validation.total_events}
                  </span>
                  <span className="text-[10px] text-paper-400 font-mono">
                    events flagged HIGH+ ({validation.flagged_pct}%)
                  </span>
                </div>
                <p className="text-[9px] text-paper-400 leading-normal">{validation.methodology}</p>
                <p className="text-[9px] text-silt-300 leading-normal italic">⚠ {validation.caveat}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
