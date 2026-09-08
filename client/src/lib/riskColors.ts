export type { RiskTier } from './riskTheme';
import { RiskLevel } from '../types/api';
import { RISK_TIERS, FALLBACK_RISK_COLOR } from './riskTheme';

export const RISK_COLORS: Record<RiskLevel | 'NONE', string> = {
  LOW: RISK_TIERS.LOW.hex,
  MODERATE: RISK_TIERS.MODERATE.hex,
  HIGH: RISK_TIERS.HIGH.hex,
  SEVERE: RISK_TIERS.SEVERE.hex,
  NONE: FALLBACK_RISK_COLOR,
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
        bg: 'bg-risk-low-bg',
        text: 'text-risk-low',
        border: 'border-[#79c8a5]/50',
        dot: 'bg-[#79c8a5]',
      };
    case 'MODERATE':
      return {
        bg: 'bg-risk-moderate-bg',
        text: 'text-risk-moderate',
        border: 'border-[#d8c56a]/50',
        dot: 'bg-[#d8c56a]',
      };
    case 'HIGH':
      return {
        bg: 'bg-risk-high-bg',
        text: 'text-risk-high',
        border: 'border-[#e49a62]/50',
        dot: 'bg-[#e49a62]',
      };
    case 'SEVERE':
      return {
        bg: 'bg-risk-severe-bg',
        text: 'text-risk-severe',
        border: 'border-[#ef7070]/50',
        dot: 'bg-[#ef7070]',
      };
    default:
      return {
        bg: 'bg-ink-800/80',
        text: 'text-paper-400',
        border: 'border-line-subtle',
        dot: 'bg-paper-400',
      };
  }
}

export function getRiskBgColor(level: RiskLevel | null | undefined): string {
  return getRiskBadgeClasses(level).bg;
}


