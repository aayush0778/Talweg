import React from 'react';
import { FactorContribution } from '../types/api';
import { FACTOR_META, contributionShare } from '../lib/factors';

interface FactorBreakdownProps {
  factors: FactorContribution[];
  riskScore: number;
  isScenario: boolean;
}

export const FactorBreakdown: React.FC<FactorBreakdownProps> = ({
  factors,
  riskScore,
  isScenario,
}) => {
  return (
    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Risk Factor Breakdown
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Each factor's share of the total score
          </p>
        </div>

        {isScenario ? (
          <span className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-700/70 text-amber-300 text-[10px] font-bold tracking-wider uppercase">
            Scenario
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/70 text-slate-400 text-[10px] font-semibold tracking-wider uppercase">
            Observed
          </span>
        )}
      </div>

      {/* Factor Rows */}
      <div className="space-y-2.5 pt-1">
        {factors.map((factor) => {
          const meta = FACTOR_META[factor.factor] ?? {
            label: factor.factor,
            format: (v: number) => String(v),
          };
          const share = contributionShare(factor.contribution, riskScore);
          const formattedRaw = meta.format(factor.raw);
          const weightPct = Math.round(factor.weight * 100);

          return (
            <div key={factor.factor} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-slate-300">{meta.label}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    ({formattedRaw})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    weight {weightPct}%
                  </span>
                  <span className="font-mono font-semibold text-slate-200 min-w-[2.5rem] text-right">
                    {share !== null ? `${share}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Share Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400/80 rounded-full transition-all duration-500"
                  style={{
                    width: `${share !== null ? Math.min(100, Math.max(0, share)) : 0}%`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
