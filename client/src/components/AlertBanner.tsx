import React, { useState } from 'react';
import { AlertResponse } from '../types/api';

interface AlertBannerProps {
  alerts: AlertResponse[];
  onSelectZone: (zoneId: string) => void;
  onDismiss?: (alertId?: number) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alerts, onSelectZone, onDismiss }) => {
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<number>>(new Set());
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);

  if (!alerts || alerts.length === 0 || isBannerDismissed) {
    return null;
  }

  const activeAlerts = alerts.filter((alert) => !dismissedAlertIds.has(alert.id));

  if (activeAlerts.length === 0) {
    return null;
  }

  const visibleAlerts = activeAlerts.slice(0, 3);

  const handleDismissOne = (e: React.MouseEvent, alertId: number) => {
    e.stopPropagation();
    setDismissedAlertIds((prev) => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  };

  const handleDismissAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBannerDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[90%] max-w-lg space-y-2 pointer-events-auto">
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          ACTIVE ALERTS · {activeAlerts.length}
        </span>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 3 && (
            <span className="text-[10px] text-slate-400 font-mono">
              +{activeAlerts.length - 3} more
            </span>
          )}
          <button
            onClick={handleDismissAll}
            className="text-[10px] text-slate-400 hover:text-white hover:bg-slate-800/80 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
            title="Dismiss all active alerts"
          >
            <span>Dismiss all</span>
            <span>✕</span>
          </button>
        </div>
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
            className={`group flex flex-col p-3 rounded-xl bg-slate-900/95 backdrop-blur-md border border-slate-800 border-l-4 ${borderStyle} shadow-2xl hover:bg-slate-800 hover:border-slate-700 transition cursor-pointer relative`}
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

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-sky-400 group-hover:text-sky-300 group-hover:translate-x-0.5 transition font-medium inline-flex items-center gap-0.5">
                  <span>View zone</span>
                  <span>→</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDismissOne(e, alert.id)}
                  className="p-1 -mr-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-700/80 transition cursor-pointer"
                  title="Close this alert"
                  aria-label="Close alert"
                >
                  <span className="text-xs font-bold leading-none block">✕</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed pr-2">
              {alert.message}
            </p>
          </div>
        );
      })}
    </div>
  );
};

