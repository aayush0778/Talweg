import { describe, it, expect } from 'vitest';
import { FACTOR_META, contributionShare } from './factors';

describe('Factor Metadata & Contribution Share (factors.ts)', () => {
  it('FACTOR_META contains all five engine factor keys', () => {
    const requiredKeys = [
      'rainfall_24h',
      'rainfall_3d',
      'slope',
      'soil_moisture',
      'historical_density',
    ];
    for (const key of requiredKeys) {
      expect(FACTOR_META).toHaveProperty(key);
      expect(typeof FACTOR_META[key].label).toBe('string');
      expect(typeof FACTOR_META[key].format).toBe('function');
    }
  });

  it('calculates rounded contribution share correctly for standard input', () => {
    // 0.128 / 0.508 = 0.251968... -> 25%
    expect(contributionShare(0.128, 0.508)).toBe(25);
  });

  it('returns null when totalScore is zero or negative', () => {
    expect(contributionShare(0.128, 0)).toBeNull();
    expect(contributionShare(0.128, -0.5)).toBeNull();
  });

  it('calculates rounded contribution share for lower values', () => {
    // 0.072 / 0.508 = 0.141732... -> 14%
    expect(contributionShare(0.072, 0.508)).toBe(14);
  });

  it('formats soil moisture as percentage string', () => {
    expect(FACTOR_META.soil_moisture.format(0.78)).toBe('78%');
    expect(FACTOR_META.soil_moisture.format(1.0)).toBe('100%');
    expect(FACTOR_META.soil_moisture.format(0.0)).toBe('0%');
  });

  it('formats slope as degrees string', () => {
    expect(FACTOR_META.slope.format(35)).toBe('35°');
    expect(FACTOR_META.slope.format(42.5)).toBe('42.5°');
  });
});
