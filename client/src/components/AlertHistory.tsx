import React, { useState, useEffect } from 'react';
import { BellRing, ChevronUp, ChevronDown } from 'lucide-react';
import type { AlertResponse, RiskLevel } from '../types/api';
import { fetchAlerts } from '../lib/apiClient';
import { formatObsTimestamp } from '../lib/format';

interface AlertHistoryProps {
  zoneId: string;
}

const severityBadgeStyles: Record<RiskLevel, string> = {
  LOW: 'bg-risk-low/15 border-risk-low/40 text-risk-low',
  MODERATE: 'bg-risk-moderate/15 border-risk-moderate/40 text-risk-moderate',
  HIGH: 'bg-risk-high/15 border-risk-high/40 text-risk-high',
  SEVERE: 'bg-risk-severe/15 border-risk-severe/40 text-risk-severe',
};

const statusBadgeStyles: Record<string, string> = {
  active: 'bg-risk-severe/15 text-risk-severe border-risk-severe/40',
  acknowledged: 'bg-risk-moderate/15 text-risk-moderate border-risk-moderate/40',
  resolved: 'bg-risk-low/15 text-risk-low border-risk-low/40',
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
    <div className="rounded-lg border border-line-strong bg-ink-950/80 overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-ink-900/60 transition cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <BellRing className="w-3.5 h-3.5 text-paper-400" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
            Alert Incident Log
          </span>
          {alerts.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-ink-800 text-paper-300 font-mono border border-line-subtle">
              {alerts.length}
            </span>
          )}
        </div>
        <span className="text-xs text-paper-400 font-mono flex items-center gap-1">
          <span>{isOpen ? 'Hide' : 'View'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
        </span>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-line-subtle space-y-3 bg-ink-900/30">
          {loading ? (
            <p className="text-xs text-paper-400 py-2 text-center italic">Loading incident history...</p>
          ) : error ? (
            <p className="text-xs text-risk-severe py-2">{error}</p>
          ) : alerts.length === 0 ? (
            <div className="p-3 text-center rounded bg-ink-950 border border-line-subtle text-xs text-paper-400">
              No historical alert records logged for this corridor.
            </div>
          ) : (
            <div className="relative pl-4 space-y-3 mt-2 border-l border-line-strong">
              {alerts.map((alert) => {
                const badgeClass =
                  severityBadgeStyles[alert.severity] || severityBadgeStyles.MODERATE;
                const statusClass =
                  statusBadgeStyles[alert.status] || 'bg-ink-800 text-paper-300';

                return (
                  <div key={alert.id} className="relative">
                    <div className="absolute -left-[21px] top-2 w-2 h-2 rounded-full bg-ink-700 border border-ink-950" />
                    <div className="p-2.5 rounded-md bg-ink-950/70 border border-line-subtle text-xs space-y-1.5">
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
                        <span className="text-[10px] text-paper-400 font-mono">
                          {formatObsTimestamp(alert.created_at)}
                        </span>
                      </div>
                      <p className="text-paper-200 text-[11px] leading-relaxed">{alert.message}</p>
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
