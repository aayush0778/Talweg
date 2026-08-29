import { RiskLevel } from '../types/api';

export const RISK_COLORS: Record<RiskLevel | 'NONE', string> = {
  LOW: '#22c55e',
  MODERATE: '#eab308',
  HIGH: '#f97316',
  SEVERE: '#dc2626',
  NONE: '#64748b',
} as const;

export function getRiskColor(level: RiskLevel | null | undefined): string {
  if (!level || !(level in RISK_COLORS)) {
    return RISK_COLORS.NONE;
  }
  return RISK_COLORS[level as RiskLevel];
}

export function getRiskBadgeClasses(level: RiskLevel | null | undefined): {
  bg: string;
  text: string;
  border: string;
  dot: string;
} {
  switch (level) {
    case 'LOW':
      return {
        bg: 'bg-emerald-950/70',
        text: 'text-emerald-400',
        border: 'border-emerald-700/50',
        dot: 'bg-emerald-500',
      };
    case 'MODERATE':
      return {
        bg: 'bg-amber-950/70',
        text: 'text-amber-400',
        border: 'border-amber-700/50',
        dot: 'bg-amber-500',
      };
    case 'HIGH':
      return {
        bg: 'bg-orange-950/70',
        text: 'text-orange-400',
        border: 'border-orange-700/50',
        dot: 'bg-orange-500',
      };
    case 'SEVERE':
      return {
        bg: 'bg-rose-950/70',
        text: 'text-rose-400',
        border: 'border-rose-700/50',
        dot: 'bg-rose-500',
      };
    default:
      return {
        bg: 'bg-slate-800/80',
        text: 'text-slate-400',
        border: 'border-slate-700/50',
        dot: 'bg-slate-500',
      };
  }
}
