import React from 'react';
import { RiskZone } from '../types/api';
import { RiskBadge } from './RiskBadge';
import { getRiskColor } from '../lib/riskColors';
import { scoreToPercent } from '../lib/format';

interface ZoneListProps {
  zones: RiskZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

export const ZoneList: React.FC<ZoneListProps> = ({ zones, selectedZoneId, onSelectZone }) => {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-white tracking-tight">Monitored Risk Zones</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
            {zones.length} Zones
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Select a micro-corridor on the map or list to inspect real-time telemetry and risk factors.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const pct = scoreToPercent(zone.risk_score);
          const color = getRiskColor(zone.risk_level);

          return (
            <div
              key={zone.id}
              onClick={() => onSelectZone(zone.id)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800/90 border-emerald-500 shadow-md shadow-emerald-950/30 ring-1 ring-emerald-500/50'
                  : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white tracking-tight">{zone.name}</h3>
                  {zone.base_slope && (
                    <span className="text-[11px] text-slate-400">Slope: {zone.base_slope}° base</span>
                  )}
                </div>
                <RiskBadge level={zone.risk_level} />
              </div>

              {zone.description && (
                <p className="text-xs text-slate-400 line-clamp-2 mb-3 leading-relaxed">
                  {zone.description}
                </p>
              )}

              {pct !== null ? (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-medium">
                    <span>Risk Index</span>
                    <span className="text-slate-200 font-semibold">{pct} / 100</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 italic">No observation available</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
