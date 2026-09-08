import React from 'react';
import { RISK_COLORS, RiskTier } from '../lib/riskColors';

interface LegendLevel {
  label: RiskTier;
  color: string;
  range: string;
}

export const MapLegend: React.FC = () => {
  const levels: LegendLevel[] = [
    { label: 'LOW', color: RISK_COLORS.LOW, range: '≤ 0.30' },
    { label: 'MODERATE', color: RISK_COLORS.MODERATE, range: '0.31 – 0.56' },
    { label: 'HIGH', color: RISK_COLORS.HIGH, range: '0.57 – 0.80' },
    { label: 'SEVERE', color: RISK_COLORS.SEVERE, range: '> 0.80' },
  ];

  return (
    <div className="absolute bottom-6 left-6 z-10 bg-ink-900/92 backdrop-blur-md border border-line-strong shadow-panel rounded-lg p-3 text-xs text-paper-300 max-w-xs pointer-events-auto">
      <div className="text-[11px] font-mono font-medium text-paper-400 uppercase tracking-wider mb-2 flex items-center justify-between">
        <span>Corridor Risk Tiers</span>
        <span className="text-[10px] text-paper-400 font-mono">Score</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-2.5">
        {levels.map((item) => (
          <div key={item.label} className="flex items-center space-x-2">
            <span
              className="w-3 h-3 rounded-sm border border-black/40 shrink-0 shadow-sm"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span className="text-[11px] font-mono font-semibold text-paper-100">{item.label}</span>
            <span className="text-[10px] font-mono text-paper-400">{item.range}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-line-subtle flex items-center space-x-2 text-[11px] text-paper-300">
        <span className="w-2.5 h-2.5 rounded-full bg-ink-950 border-2 border-paper-100 shrink-0 shadow-sm" aria-hidden="true" />
        <span>Historical Landslide Incident</span>
      </div>
    </div>
  );
};
