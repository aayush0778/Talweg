import React from 'react';
import type { RiskLevel } from '../types/api';
import { getNotificationChain } from '../lib/stakeholders';

interface NotificationChainProps {
  riskLevel: RiskLevel;
}

const tierColors: Record<RiskLevel, { bg: string; border: string; text: string; dot: string }> = {
  LOW: { bg: 'bg-emerald-950/30', border: 'border-emerald-800/50', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  MODERATE: { bg: 'bg-amber-950/30', border: 'border-amber-800/50', text: 'text-amber-400', dot: 'bg-amber-400' },
  HIGH: { bg: 'bg-orange-950/30', border: 'border-orange-800/50', text: 'text-orange-400', dot: 'bg-orange-400' },
  SEVERE: { bg: 'bg-rose-950/30', border: 'border-rose-800/50', text: 'text-rose-400', dot: 'bg-rose-400' },
};

export const NotificationChain: React.FC<NotificationChainProps> = ({ riskLevel }) => {
  const chain = getNotificationChain(riskLevel);

  return (
    <div className="space-y-2 mt-3">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        📱 Notification Escalation Chain
      </h4>
      <div className="relative pl-4">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-slate-700" />

        {chain.map((tier) => {
          const colors = tierColors[tier.level];
          const isActive = tier.stakeholders.some((s) => s.active);

          return (
            <div key={tier.level} className="relative mb-3 last:mb-0">
              {/* Dot on the line */}
              <div
                className={`absolute -left-4 top-2.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                  isActive ? colors.dot : 'bg-slate-700'
                } ${isActive && tier.level === riskLevel ? 'animate-pulse' : ''}`}
              />

              <div
                className={`ml-2 p-2.5 rounded-lg border transition-all ${
                  isActive
                    ? `${colors.bg} ${colors.border}`
                    : 'bg-slate-900/30 border-slate-800/30 opacity-40'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isActive ? colors.text : 'text-slate-600'
                    }`}
                  >
                    {tier.label}
                  </span>
                  {isActive && tier.level === riskLevel && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {tier.stakeholders.map((s) => (
                    <div
                      key={s.role}
                      className={`flex items-center justify-between text-[11px] ${
                        s.active ? 'text-slate-300' : 'text-slate-600'
                      }`}
                    >
                      <span className="font-medium">{s.role}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px]">{s.method}</span>
                        <span
                          className={`text-[9px] font-mono ${
                            s.active ? 'text-slate-400' : 'text-slate-600'
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
