import React from 'react';
import { AlertResponse } from '../types/api';

interface AlertBannerProps {
  alerts: AlertResponse[];
  onSelectZone: (zoneId: string) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onSelectZone }) => {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const visibleAlerts = alerts.slice(0, 3);

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-lg space-y-2 pointer-events-auto">
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          ACTIVE ALERTS · {alerts.length}
        </span>
        {alerts.length > 3 && (
          <span className="text-[10px] text-slate-400 font-mono">
            +{alerts.length - 3} more
          </span>
        )}
      </div>

      {/* Alert Cards */}
      {visibleAlerts.map((alert) => {
        const isSevere = alert.severity === 'SEVERE';
        const borderStyle = isSevere ? 'border-l-rose-500' : 'border-l-orange-500';
        const badgeBg = isSevere
          ? 'bg-rose-950/80 border-rose-800/80 text-rose-300'
          : 'bg-orange-950/80 border-orange-800/80 text-orange-300';
        const scorePct = Math.round(alert.risk_score * 100);

        return (
          <div
            key={alert.id}
            onClick={() => onSelectZone(alert.zone_id)}
            className={`group flex flex-col p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 border-l-4 ${borderStyle} shadow-2xl hover:bg-slate-800 hover:border-slate-700 transition cursor-pointer`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-tight">
                  {alert.zone_name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeBg}`}
                >
                  {alert.severity} · {scorePct}/100
                </span>
              </div>

              <span className="text-[11px] text-sky-400 group-hover:text-sky-300 group-hover:translate-x-0.5 transition font-medium inline-flex items-center gap-0.5 shrink-0">
                <span>View zone</span>
                <span>→</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
              {alert.message}
            </p>
          </div>
        );
      })}
    </div>
  );
};
