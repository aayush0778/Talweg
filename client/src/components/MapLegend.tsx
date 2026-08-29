import React from 'react';
import { RISK_COLORS } from '../lib/riskColors';

export const MapLegend: React.FC = () => {
  const levels = [
    { label: 'Low Risk', color: RISK_COLORS.LOW, desc: '< 0.30' },
    { label: 'Moderate', color: RISK_COLORS.MODERATE, desc: '0.30 – 0.55' },
    { label: 'High Risk', color: RISK_COLORS.HIGH, desc: '0.56 – 0.79' },
    { label: 'Severe', color: RISK_COLORS.SEVERE, desc: '≥ 0.80' },
  ];

  return (
    <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 shadow-xl rounded-xl p-3.5 text-xs text-slate-300 max-w-xs pointer-events-auto">
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center justify-between">
        <span>Landslide Risk Level</span>
        <span className="text-[10px] text-slate-500 font-normal">Score</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
        {levels.map((item) => (
          <div key={item.label} className="flex items-center space-x-2">
            <span
              className="w-3 h-3 rounded-sm border border-black/30 shadow-sm shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-slate-200">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-slate-800/80 flex items-center space-x-2 text-[11px] text-slate-400">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-900 border-2 border-white shrink-0 shadow-sm" />
        <span>Historical Landslide Incident</span>
      </div>
    </div>
  );
};
