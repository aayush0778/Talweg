import { describe, it, expect } from 'vitest';
import { scoreToPercent, formatObsTimestamp, formatEventDate } from './format';

describe('Format Helpers (format.ts)', () => {
  it('converts decimal scores to rounded percentage integers', () => {
    expect(scoreToPercent(0.508)).toBe(51);
    expect(scoreToPercent(0.56)).toBe(56);
    expect(scoreToPercent(0.0)).toBe(0);
    expect(scoreToPercent(1.0)).toBe(100);
    expect(scoreToPercent(0.724)).toBe(72);
  });

  it('returns null for null, undefined, or NaN score values', () => {
    expect(scoreToPercent(null)).toBeNull();
    expect(scoreToPercent(undefined)).toBeNull();
    expect(scoreToPercent(NaN)).toBeNull();
  });

  it('formats ISO timestamps to standard UTC representation', () => {
    const formatted = formatObsTimestamp('2026-08-01T06:00:00.000Z');
    expect(formatted).toBe('2026-08-01 06:00 UTC');

    expect(formatObsTimestamp(null)).toBe('No data');
    expect(formatObsTimestamp('invalid')).toBe('Invalid date');
  });

  it('formats event dates cleanly', () => {
    expect(formatEventDate('2023-10-04')).toBe('2023-10-04');
    expect(formatEventDate(null)).toBe('Unknown date');
  });
});
