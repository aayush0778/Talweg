import React from 'react';
import { RiskLevel } from '../types/api';
import { getRiskBadgeClasses } from '../lib/riskColors';
import { canonicalRiskLabel } from '../lib/riskTheme';

interface RiskBadgeProps {
  level: RiskLevel | null | undefined;
  score?: number | null;
  className?: string;
  showDot?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({
  level,
  score,
  className = '',
  showDot = true,
}) => {
  const classes = getRiskBadgeClasses(level);
  const label = canonicalRiskLabel(level);

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-xs font-mono font-semibold tracking-wider uppercase border ${classes.bg} ${classes.text} ${classes.border} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${classes.dot}`} aria-hidden="true" />}
      <span>{label}</span>
      {score !== undefined && score !== null && (
        <span className="text-[10px] opacity-80 font-normal tabular-nums">
          ({score.toFixed(2)})
        </span>
      )}
    </span>
  );
};

