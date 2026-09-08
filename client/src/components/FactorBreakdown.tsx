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
    <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong shadow-inner space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
            Factor Decomposition
          </h3>
          <p className="text-[11px] text-paper-400 mt-0.5">
            Contribution of each environmental parameter
          </p>
        </div>

        {isScenario ? (
          <span className="px-2 py-0.5 rounded bg-silt-900/60 border border-silt-700 text-silt-300 text-[10px] font-mono font-bold tracking-wider uppercase">
            Scenario
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-ink-900 border border-line-subtle text-paper-400 text-[10px] font-mono font-medium tracking-wider uppercase">
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
                  <span className="font-medium text-paper-200">{meta.label}</span>
                  <span className="text-[11px] font-mono text-paper-400">
                    ({formattedRaw})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-paper-400 font-mono">
                    w:{weightPct}%
                  </span>
                  <span className="font-mono font-bold text-paper-100 min-w-[2.5rem] text-right tabular-nums">
                    {share !== null ? `${share}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Share Progress Bar: Lichen bar fill, never rainbow/risk color */}
              <div className="w-full h-1.5 bg-ink-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-lichen-500 rounded-full transition-all duration-500"
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
