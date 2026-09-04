import React from 'react';
import { RiskZone } from '../types/api';
import { RiskBadge } from './RiskBadge';

interface ZoneComparisonProps {
  zones: RiskZone[];
  onSelectZone: (zoneId: string) => void;
}

export const ZoneComparison: React.FC<ZoneComparisonProps> = ({ zones, onSelectZone }) => {
  const totalZones = zones.length;
  const highRiskZones = zones.filter(z => z.risk_level === 'HIGH' || z.risk_level === 'SEVERE').length;
  
  const totalScore = zones.reduce((acc, z) => acc + (z.risk_score || 0), 0);
  const avgScore = totalZones > 0 ? (totalScore / totalZones).toFixed(1) : '0.0';

  const sortedZones = [...zones].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0));

  const getBarColor = (level: string | null) => {
    switch (level) {
      case 'LOW': return 'bg-emerald-500';
      case 'MODERATE': return 'bg-amber-500';
      case 'HIGH': return 'bg-orange-500';
      case 'SEVERE': return 'bg-rose-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40">
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2 p-4 border-b border-slate-800/80">
        <div className="bg-slate-800/50 rounded-lg p-2 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Total Zones</span>
          <span className="text-xl font-bold text-slate-100">{totalZones}</span>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">High Risk+</span>
          <span className="text-xl font-bold text-rose-400">{highRiskZones}</span>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-2 flex flex-col items-center justify-center">
          <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Avg Risk</span>
          <span className="text-xl font-bold text-slate-100">{avgScore}%</span>
        </div>
      </div>

      {/* Bar Chart Section */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedZones.map(zone => {
          const score = zone.risk_score || 0;
          return (
            <div 
              key={zone.id} 
              onClick={() => onSelectZone(zone.id)}
              className="group flex flex-col gap-1.5 p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-800/60"
            >
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-200 group-hover:text-white transition-colors">
                  {zone.name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">{score.toFixed(1)}%</span>
                  {zone.risk_level && (
                    <RiskBadge level={zone.risk_level} className="text-[10px] px-1.5 py-0.5" />
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ease-out ${getBarColor(zone.risk_level)}`} 
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
