import { describe, it, expect } from 'vitest';
import { getResponseGuidance } from './responseGuidance';

describe('getResponseGuidance', () => {
  const zoneName = 'Test Zone';

  it('Returns LOW guidance for LOW risk level', () => {
    const guidance = getResponseGuidance('LOW', zoneName);
    expect(guidance.urgencyLevel).toBe('Routine Monitoring');
    expect(guidance.actions.length).toBe(3);
    expect(guidance.estimatedResponseTime).toBe('No immediate action');
  });

  it('Returns MODERATE guidance for MODERATE risk level', () => {
    const guidance = getResponseGuidance('MODERATE', zoneName);
    expect(guidance.urgencyLevel).toBe('Enhanced Surveillance');
    expect(guidance.actions.length).toBe(5);
    expect(guidance.estimatedResponseTime).toBe('4-6 hours readiness');
  });

  it('Returns HIGH guidance with 6+ actions for HIGH risk level', () => {
    const guidance = getResponseGuidance('HIGH', zoneName);
    expect(guidance.urgencyLevel).toBe('Advisory & Pre-positioning');
    expect(guidance.actions.length).toBeGreaterThanOrEqual(6);
    expect(guidance.estimatedResponseTime).toBe('1-2 hours mobilization');
  });

  it('Returns SEVERE guidance with "EVACUATION" in urgency level for SEVERE risk level', () => {
    const guidance = getResponseGuidance('SEVERE', zoneName);
    expect(guidance.urgencyLevel).toMatch(/EVACUATION/i);
    expect(guidance.estimatedResponseTime).toMatch(/IMMEDIATE/i);
  });

  it('Returns correct contacts for each level (more contacts at higher levels)', () => {
    const lowGuidance = getResponseGuidance('LOW', zoneName);
    const modGuidance = getResponseGuidance('MODERATE', zoneName);
    const highGuidance = getResponseGuidance('HIGH', zoneName);
    const sevGuidance = getResponseGuidance('SEVERE', zoneName);

    expect(lowGuidance.contacts.length).toBe(1);
    expect(modGuidance.contacts.length).toBe(2);
    expect(highGuidance.contacts.length).toBe(4);
    expect(sevGuidance.contacts.length).toBe(5);
  });
});
