import React, { useState } from 'react';
import type { HealthResponse } from '../types/api';

interface DataSourcePanelProps {
  health: HealthResponse | null;
}

interface DataSource {
  name: string;
  type: 'REAL' | 'DERIVED' | 'SYNTHETIC';
  description: string;
  records: string;
  status: 'connected' | 'loaded' | 'demo';
}

const DATA_SOURCES: DataSource[] = [
  {
    name: 'NASA Global Landslide Catalog',
    type: 'REAL',
    description: 'Historical landslide events with coordinates and triggers',
    records: '15 events in Sikkim corridor',
    status: 'loaded',
  },
  {
    name: 'SRTM Digital Elevation Model',
    type: 'DERIVED',
    description: 'Slope gradient computed from 30m resolution DEM',
    records: '6 zone base slopes',
    status: 'loaded',
  },
  {
    name: 'CHIRPS Rainfall Estimates',
    type: 'SYNTHETIC',
    description: 'Climate Hazards IR Precipitation — synthetic seed for demo',
    records: '6 zone observations',
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
    description: 'ExtraTreesRegressor trained on domain grid (R² > 0.998)',
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

const typeColors: Record<string, { bg: string; text: string }> = {
  REAL: { bg: 'bg-emerald-950/60', text: 'text-emerald-400' },
  DERIVED: { bg: 'bg-sky-950/60', text: 'text-sky-400' },
  SYNTHETIC: { bg: 'bg-amber-950/60', text: 'text-amber-400' },
};

const statusIndicator: Record<string, { color: string; label: string }> = {
  connected: { color: 'bg-emerald-400', label: 'Live' },
  loaded: { color: 'bg-sky-400', label: 'Loaded' },
  demo: { color: 'bg-amber-400', label: 'Demo' },
};

export const DataSourcePanel: React.FC<DataSourcePanelProps> = ({ health }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-cyan-800/50 text-cyan-300 text-xs font-medium shadow-sm hover:bg-slate-800 hover:border-cyan-700 transition cursor-pointer"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span>DEMO DATA · synthetic_seed</span>
        <span className="text-[10px] ml-1">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="absolute top-10 right-0 w-96 bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              🔌 Data Sources & Pipeline Status
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">
              {health?.database === 'connected' ? '✅ All systems operational' : '⚠️ Database degraded'} ·
              PostGIS {health?.postgis ?? '3.x'}
            </p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {DATA_SOURCES.map((src) => {
              const typeStyle = typeColors[src.type];
              const status = statusIndicator[src.status];

              return (
                <div
                  key={src.name}
                  className="px-3 py-2.5 border-b border-slate-800/60 hover:bg-slate-800/40 transition"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-200">{src.name}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text} border border-slate-800/40`}
                      >
                        {src.type}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${status.color}`} />
                        <span className="text-[9px] text-slate-400">{status.label}</span>
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">{src.description}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{src.records}</p>
                </div>
              );
            })}
          </div>

          <div className="p-2.5 bg-slate-950/80 border-t border-slate-800">
            <p className="text-[9px] text-slate-500 text-center">
              Classification: REAL = published source | DERIVED = computed from real data | SYNTHETIC = demo seed
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
