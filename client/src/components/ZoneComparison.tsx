import React from 'react';
import { ArrowUp, Minus } from 'lucide-react';
import { RiskZone } from '../types/api';
import { RiskBadge } from './RiskBadge';

interface ZoneComparisonProps {
  zones: RiskZone[];
  onSelectZone: (zoneId: string) => void;
}

export const ZoneComparison: React.FC<ZoneComparisonProps> = ({ zones, onSelectZone }) => {
  const totalZones = zones.length;
  const highRiskZones = zones.filter((z) => z.risk_level === 'HIGH' || z.risk_level === 'SEVERE').length;
  const totalScore = zones.reduce((acc, z) => acc + (z.risk_score || 0), 0);
  const avgScore = totalZones > 0 ? (totalScore / totalZones).toFixed(2) : '0.00';

  const sortedZones = [...zones].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

  return (
    <div className="flex flex-col h-full bg-ink-900 text-paper-100 overflow-hidden">
      {/* Summary KPI Strip */}
      <div className="grid grid-cols-3 gap-2 p-3 border-b border-line-strong bg-ink-950/60">
        <div className="bg-ink-900 border border-line-subtle rounded-md p-2 flex flex-col items-center">
          <span className="text-[10px] font-mono text-paper-400 uppercase tracking-wider">Total</span>
          <span className="text-base font-mono font-bold text-paper-50">{totalZones}</span>
        </div>
        <div className="bg-ink-900 border border-line-subtle rounded-md p-2 flex flex-col items-center">
          <span className="text-[10px] font-mono text-risk-severe uppercase tracking-wider">High+</span>
          <span className="text-base font-mono font-bold text-risk-severe">{highRiskZones}</span>
        </div>
        <div className="bg-ink-900 border border-line-subtle rounded-md p-2 flex flex-col items-center">
          <span className="text-[10px] font-mono text-paper-400 uppercase tracking-wider">Avg Score</span>
          <span className="text-base font-mono font-bold text-paper-50 tabular-nums">{avgScore}</span>
        </div>
      </div>

      {/* Cross-corridor comparison table with internal horizontal scroll & sticky corridor */}
      <div className="flex-1 overflow-x-auto overflow-y-auto">
        <table className="w-full text-left border-collapse min-w-[500px]">
          <thead className="bg-ink-950/80 sticky top-0 z-10 border-b border-line-strong">
            <tr>
              <th className="p-2.5 text-[10px] font-mono text-paper-400 uppercase tracking-wider sticky left-0 bg-ink-950 z-20">
                Corridor
              </th>
              <th className="p-2.5 text-[10px] font-mono text-paper-400 uppercase tracking-wider text-right">
                Slope
              </th>
              <th className="p-2.5 text-[10px] font-mono text-paper-400 uppercase tracking-wider text-right">
                Score
              </th>
              <th className="p-2.5 text-[10px] font-mono text-paper-400 uppercase tracking-wider text-center">
                Tier
              </th>
              <th className="p-2.5 text-[10px] font-mono text-paper-400 uppercase tracking-wider text-center">
                Trend
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle text-xs">
            {sortedZones.map((zone) => {
              const score = (zone.risk_score ?? 0).toFixed(2);
              const isElevated = zone.risk_level === 'HIGH' || zone.risk_level === 'SEVERE';

              return (
                <tr
                  key={zone.id}
                  onClick={() => onSelectZone(zone.id)}
                  className="hover:bg-ink-800/50 cursor-pointer transition-colors"
                >
                  <td className="p-2.5 font-medium text-paper-100 truncate max-w-[160px] sticky left-0 bg-ink-900">
                    {zone.name}
                  </td>
                  <td className="p-2.5 font-mono text-right text-paper-300 tabular-nums">
                    {zone.base_slope ? `${zone.base_slope}°` : '—'}
                  </td>
                  <td className="p-2.5 font-mono font-bold text-right text-paper-50 tabular-nums">
                    {score}
                  </td>
                  <td className="p-2.5 text-center">
                    <RiskBadge level={zone.risk_level} />
                  </td>
                  <td className="p-2.5 text-center">
                    {isElevated ? (
                      <span className="inline-flex items-center text-risk-severe" title="Elevated trajectory">
                        <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-paper-400" title="Stable trajectory">
                        <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
