import React from 'react';
import { Radio } from 'lucide-react';
import type { RiskLevel } from '../types/api';
import { getNotificationChain } from '../lib/stakeholders';

interface NotificationChainProps {
  riskLevel: RiskLevel;
}

const tierColors: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  LOW: { bg: 'bg-risk-low/10', border: 'border-risk-low/30', text: 'text-risk-low', dot: 'bg-risk-low' },
  MODERATE: { bg: 'bg-risk-moderate/10', border: 'border-risk-moderate/30', text: 'text-risk-moderate', dot: 'bg-risk-moderate' },
  HIGH: { bg: 'bg-risk-high/10', border: 'border-risk-high/30', text: 'text-risk-high', dot: 'bg-risk-high' },
  SEVERE: { bg: 'bg-risk-severe/10', border: 'border-risk-severe/30', text: 'text-risk-severe', dot: 'bg-risk-severe' },
};

export const NotificationChain: React.FC<NotificationChainProps> = ({ riskLevel }) => {
  const chain = getNotificationChain(riskLevel);

  return (
    <div className="space-y-2 mt-3">
      <div className="flex items-center gap-1.5">
        <Radio className="w-3.5 h-3.5 text-paper-400" aria-hidden="true" />
        <h4 className="text-[10px] font-mono font-semibold uppercase tracking-wider text-paper-400">
          Escalation Chain
        </h4>
      </div>
      <div className="relative pl-4">
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-line-strong" />

        {chain.map((tier) => {
          const colors = tierColors[tier.level];
          const isActive = tier.stakeholders.some((s) => s.active);

          return (
            <div key={tier.level} className="relative mb-3 last:mb-0">
              <div
                className={`absolute -left-4 top-2.5 w-3 h-3 rounded-full border-2 border-ink-950 ${
                  isActive ? colors.dot : 'bg-ink-800'
                } ${isActive && tier.level === riskLevel ? 'animate-pulse' : ''}`}
              />

              <div
                className={`ml-2 p-2.5 rounded border transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.border}`
                    : 'bg-ink-950/30 border-line-subtle opacity-40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                      isActive ? colors.text : 'text-paper-400'
                    }`}
                  >
                    {tier.label}
                  </span>
                  {isActive && tier.level === riskLevel && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-ink-900 text-paper-200 font-mono border border-line-subtle">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {tier.stakeholders.map((s) => (
                    <div
                      key={s.role}
                      className={`flex items-center justify-between text-xs ${
                        s.active ? 'text-paper-200' : 'text-paper-400'
                      }`}
                    >
                      <span className="font-medium">{s.role}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-paper-400 text-[10px] font-mono">{s.method}</span>
                        <span
                          className={`text-[9px] font-mono ${
                            s.active ? 'text-paper-300' : 'text-paper-400'
                          }`}
                        >
                          {s.responseTime}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
