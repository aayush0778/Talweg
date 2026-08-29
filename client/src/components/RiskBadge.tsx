import React from 'react';
import { RiskLevel } from '../types/api';
import { getRiskBadgeClasses } from '../lib/riskColors';

interface RiskBadgeProps {
  level: RiskLevel | null | undefined;
  className?: string;
  showDot?: boolean;
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, className = '', showDot = true }) => {
  const classes = getRiskBadgeClasses(level);
  const label = level || 'NO DATA';

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide border ${classes.bg} ${classes.text} ${classes.border} ${className}`}
    >
      {showDot && <span className={`w-1.5 h-1.5 rounded-full ${classes.dot}`} />}
      {label}
    </span>
  );
};
