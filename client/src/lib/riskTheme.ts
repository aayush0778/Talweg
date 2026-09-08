import type { RiskLevel } from '../types/api';

export type RiskTier = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export interface RiskTierConfig {
  tier: RiskTier;
  label: RiskTier;
  hex: string;
  bgHex: string;
  className: string;
  textClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  description: string;
}

export const RISK_TIERS: Record<RiskTier, RiskTierConfig> = {
  LOW: {
    tier: 'LOW',
    label: 'LOW',
    hex: '#79c8a5',
    bgHex: '#173d35',
    className: 'risk-low',
    textClass: 'text-risk-low',
    bgClass: 'bg-risk-low-bg',
    borderClass: 'border-[#79c8a5]/50',
    dotClass: 'bg-[#79c8a5]',
    description: 'Minimal slope instability. Normal monitoring posture.',
  },
  MODERATE: {
    tier: 'MODERATE',
    label: 'MODERATE',
    hex: '#d8c56a',
    bgHex: '#4b421b',
    className: 'risk-moderate',
    textClass: 'text-risk-moderate',
    bgClass: 'bg-risk-moderate-bg',
    borderClass: 'border-[#d8c56a]/50',
    dotClass: 'bg-[#d8c56a]',
    description: 'Elevated saturation or precipitation. Heightened vigilance.',
  },
  HIGH: {
    tier: 'HIGH',
    label: 'HIGH',
    hex: '#e49a62',
    bgHex: '#4e2d1f',
    className: 'risk-high',
    textClass: 'text-risk-high',
    bgClass: 'bg-risk-high-bg',
    borderClass: 'border-[#e49a62]/50',
    dotClass: 'bg-[#e49a62]',
    description: 'Critical threshold crossed. Active slope mobilization probable.',
  },
  SEVERE: {
    tier: 'SEVERE',
    label: 'SEVERE',
    hex: '#ef7070',
    bgHex: '#512327',
    className: 'risk-severe',
    textClass: 'text-risk-severe',
    bgClass: 'bg-risk-severe-bg',
    borderClass: 'border-[#ef7070]/50',
    dotClass: 'bg-[#ef7070]',
    description: 'Imminent failure or ongoing mass wasting event.',
  },
};

export const FALLBACK_RISK_COLOR = '#405054';

export function getRiskTierConfig(level: RiskLevel | null | undefined): RiskTierConfig | null {
  if (!level) return null;
  const upper = level.toUpperCase() as RiskTier;
  return RISK_TIERS[upper] || null;
}

export function canonicalRiskLabel(level: RiskLevel | null | undefined): string {
  if (!level) return 'NO DATA';
  const config = getRiskTierConfig(level);
  return config ? config.label : String(level).toUpperCase();
}
