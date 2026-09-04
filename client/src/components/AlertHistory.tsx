import React, { useState, useEffect } from 'react';
import type { AlertResponse, RiskLevel } from '../types/api';
import { fetchAlerts } from '../lib/apiClient';
import { formatObsTimestamp } from '../lib/format';

interface AlertHistoryProps {
  zoneId: string;
}

const severityBadgeStyles: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
  MODERATE: 'bg-amber-950/60 border-amber-800/60 text-amber-300',
  HIGH: 'bg-orange-950/60 border-orange-800/60 text-orange-300',
  SEVERE: 'bg-rose-950/60 border-rose-800/60 text-rose-300',
};

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-rose-950/40 text-rose-300 border-rose-800/50',
  acknowledged: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
  resolved: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50',
};

export const AlertHistory: React.FC<AlertHistoryProps> = ({ zoneId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAlerts({ status: 'all', zone_id: zoneId })
      .then((data) => {
        if (!cancelled) {
          setAlerts(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load alert history');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-900/40 transition cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            📜 Alert Incident Audit Log
          </span>
          {alerts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
              {alerts.length}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 font-mono">{isOpen ? '▲ Hide' : '▼ View'}</span>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-slate-800/60 space-y-3">
          {loading ? (
            <p className="text-xs text-slate-500 py-2 text-center italic">Loading incident history...</p>
          ) : error ? (
            <p className="text-xs text-rose-400 py-2">{error}</p>
          ) : alerts.length === 0 ? (
            <div className="p-3 text-center rounded-lg bg-slate-900/30 border border-slate-800/40 text-xs text-slate-500">
              No historical alert records logged for this corridor.
            </div>
          ) : (
            <div className="relative pl-4 space-y-3 mt-2">
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-800" />
              {alerts.map((alert) => {
                const badgeClass =
                  severityBadgeStyles[alert.severity] || severityBadgeStyles.MODERATE;
                const statusClass =
                  statusBadgeStyles[alert.status] || 'bg-slate-800 text-slate-300';

                return (
                  <div key={alert.id} className="relative">
                    <div className="absolute -left-4 top-2 w-2 h-2 rounded-full bg-slate-600 border border-slate-900" />
                    <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800/70 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${badgeClass}`}
                          >
                            {alert.severity}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border ${statusClass}`}
                          >
                            {alert.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {formatObsTimestamp(alert.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed">{alert.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
