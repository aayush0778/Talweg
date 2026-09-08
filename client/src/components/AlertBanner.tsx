import React, { useState } from 'react';
import { ArrowRight, X, TriangleAlert } from 'lucide-react';
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
    <div
      role="status"
      aria-live="polite"
      className="absolute top-16 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-lg space-y-2 pointer-events-auto"
    >
      {/* Top Header Label */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-risk-high flex items-center gap-1.5">
          <TriangleAlert className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
          ACTIVE ALERTS · {activeAlerts.length}
        </span>
        <div className="flex items-center gap-2">
          {activeAlerts.length > 3 && (
            <span className="text-[10px] text-paper-400 font-mono">
              +{activeAlerts.length - 3} more
            </span>
          )}
          <button
            onClick={handleDismissAll}
            className="text-[10px] text-paper-400 hover:text-paper-100 hover:bg-ink-800 px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 font-mono"
            title="Dismiss all active alerts"
          >
            <span>Dismiss all</span>
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Alert Cards */}
      {visibleAlerts.map((alert) => {
        const isSevere = alert.severity === 'SEVERE';
        const borderStyle = isSevere ? 'border-l-risk-severe' : 'border-l-risk-high';
        const badgeBg = isSevere
          ? 'bg-risk-severe/15 border-risk-severe/40 text-risk-severe'
          : 'bg-risk-high/15 border-risk-high/40 text-risk-high';
        const scorePct = Math.round(alert.risk_score * 100);

        return (
          <div
            key={alert.id}
            onClick={() => onSelectZone(alert.zone_id)}
            className={`group flex flex-col p-3 rounded-lg bg-ink-900/95 backdrop-blur-md border border-line-strong border-l-4 ${borderStyle} shadow-panel hover:bg-ink-800/90 transition cursor-pointer relative`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-paper-50 tracking-tight">
                  {alert.zone_name}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeBg}`}
                >
                  {alert.severity} · {scorePct}/100
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-lichen-400 group-hover:text-lichen-300 transition font-mono font-medium inline-flex items-center gap-1">
                  <span>Inspect</span>
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDismissOne(e, alert.id)}
                  className="p-1 -mr-1 rounded text-paper-400 hover:text-paper-100 hover:bg-ink-800 transition cursor-pointer"
                  title="Close this alert"
                  aria-label="Close alert"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <p className="text-xs text-paper-300 line-clamp-2 leading-relaxed pr-2">
              {alert.message}
            </p>
          </div>
        );
      })}
    </div>
  );
};
