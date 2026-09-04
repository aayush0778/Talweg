import { describe, it, expect } from 'vitest';
import { getNotificationChain } from './stakeholders';

describe('getNotificationChain', () => {
  it('returns 4 notification tiers with escalating stakeholders', () => {
    const chain = getNotificationChain('LOW');
    expect(chain).toHaveLength(4);
    // At LOW, only LOW stakeholders should be active
    const lowTier = chain.find((t) => t.level === 'LOW')!;
    expect(lowTier.stakeholders.every((s) => s.active)).toBe(true);

    const severeTier = chain.find((t) => t.level === 'SEVERE')!;
    expect(severeTier.stakeholders.every((s) => !s.active)).toBe(true);
  });

  it('activates all stakeholders up to SEVERE at SEVERE level', () => {
    const chain = getNotificationChain('SEVERE');
    chain.forEach((tier) => {
      expect(tier.stakeholders.every((s) => s.active)).toBe(true);
    });
  });

  it('activates up to HIGH at HIGH level', () => {
    const chain = getNotificationChain('HIGH');
    const highTier = chain.find((t) => t.level === 'HIGH')!;
    const severeTier = chain.find((t) => t.level === 'SEVERE')!;
    expect(highTier.stakeholders.every((s) => s.active)).toBe(true);
    expect(severeTier.stakeholders.every((s) => !s.active)).toBe(true);
  });
});
