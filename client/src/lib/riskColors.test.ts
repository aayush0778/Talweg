import { describe, it, expect } from 'vitest';
import { getRiskColor, getRiskBadgeClasses, RISK_COLORS } from './riskColors';

describe('Risk Colors (riskColors.ts)', () => {
  it('maps all defined risk levels to distinct valid hex colors', () => {
    expect(getRiskColor('LOW')).toBe('#79c8a5');
    expect(getRiskColor('MODERATE')).toBe('#d8c56a');
    expect(getRiskColor('HIGH')).toBe('#e49a62');
    expect(getRiskColor('SEVERE')).toBe('#ef7070');
  });

  it('maps null or undefined risk level to slate gray fallback color', () => {
    expect(getRiskColor(null)).toBe(RISK_COLORS.NONE);
    expect(getRiskColor(undefined)).toBe(RISK_COLORS.NONE);
  });

  it('provides Tailwind classes with matching text/bg/border for all levels', () => {
    const low = getRiskBadgeClasses('LOW');
    expect(low.text).toBe('text-risk-low');
    expect(low.bg).toBe('bg-risk-low-bg');

    const mod = getRiskBadgeClasses('MODERATE');
    expect(mod.text).toBe('text-risk-moderate');

    const high = getRiskBadgeClasses('HIGH');
    expect(high.text).toBe('text-risk-high');

    const severe = getRiskBadgeClasses('SEVERE');
    expect(severe.text).toBe('text-risk-severe');

    const none = getRiskBadgeClasses(null);
    expect(none.text).toBe('text-paper-400');
  });
});

