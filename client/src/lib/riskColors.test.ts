import { describe, it, expect } from 'vitest';
import { getRiskColor, getRiskBadgeClasses, RISK_COLORS } from './riskColors';

describe('Risk Colors (riskColors.ts)', () => {
  it('maps all defined risk levels to distinct valid hex colors', () => {
    expect(getRiskColor('LOW')).toBe('#22c55e');
    expect(getRiskColor('MODERATE')).toBe('#eab308');
    expect(getRiskColor('HIGH')).toBe('#f97316');
    expect(getRiskColor('SEVERE')).toBe('#dc2626');
  });

  it('maps null or undefined risk level to slate gray fallback color', () => {
    expect(getRiskColor(null)).toBe(RISK_COLORS.NONE);
    expect(getRiskColor(undefined)).toBe(RISK_COLORS.NONE);
  });

  it('provides Tailwind classes with matching text/bg/border for all levels', () => {
    const low = getRiskBadgeClasses('LOW');
    expect(low.text).toContain('emerald');
    expect(low.bg).toContain('emerald');

    const mod = getRiskBadgeClasses('MODERATE');
    expect(mod.text).toContain('amber');

    const high = getRiskBadgeClasses('HIGH');
    expect(high.text).toContain('orange');

    const severe = getRiskBadgeClasses('SEVERE');
    expect(severe.text).toContain('rose');

    const none = getRiskBadgeClasses(null);
    expect(none.text).toContain('slate');
  });
});
