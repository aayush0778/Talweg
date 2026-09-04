import React from 'react';
import { HealthResponse } from '../types/api';
import { DataSourcePanel } from './DataSourcePanel';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: Error | null;
  onOpenShortcuts?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ health, healthLoading, healthError, onOpenShortcuts }) => {
  const isOk = health?.status === 'ok' && health?.database === 'connected';

  return (
    <header className="h-16 px-6 bg-slate-950/90 backdrop-blur border-b border-slate-800/80 flex items-center justify-between z-20 shrink-0">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
          <span className="text-emerald-400 font-black text-base tracking-tighter">TW</span>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-tight">Talweg</h1>
            <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/60">
              SIH 2026
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Landslide Early Warning &amp; Risk Intelligence — <span className="text-slate-300 font-medium">Sikkim Prototype</span>
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        {/* Keyboard Shortcuts Trigger Button */}
        {onOpenShortcuts && (
          <button
            onClick={onOpenShortcuts}
            className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-medium transition cursor-pointer"
            title="View Keyboard Shortcuts (?)"
          >
            <span>⌨️</span>
            <span>Shortcuts</span>
          </button>
        )}

        {/* Interactive Data Source & Pipeline Dashboard */}
        <DataSourcePanel health={health} />

        {/* Live System Health Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium transition-colors shadow-sm ${
            healthLoading && !health
              ? 'bg-slate-900 border-slate-700 text-slate-400'
              : isOk && !healthError
                ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                : 'bg-amber-950/70 border-amber-700/60 text-amber-300'
          }`}
          title={
            isOk
              ? `Connected to PostgreSQL with PostGIS ${health?.postgis || '3.x'}`
              : healthError?.message || 'Database connection degraded'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              healthLoading && !health
                ? 'bg-slate-500 animate-pulse'
                : isOk && !healthError
                  ? 'bg-emerald-400'
                  : 'bg-amber-400 animate-ping'
            }`}
          />
          <span>
            {healthLoading && !health
              ? 'Connecting...'
              : isOk && !healthError
                ? `Live · PostgreSQL · PostGIS`
                : 'Degraded · DB Disconnected'}
          </span>
        </div>
      </div>
    </header>
  );
};
