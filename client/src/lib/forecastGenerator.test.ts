import { describe, it, expect } from 'vitest';
import { generateForecast } from './forecastGenerator';

describe('generateForecast', () => {
  it('generates 5 forecast days starting from tomorrow', () => {
    const forecast = generateForecast(65, 'MODERATE');
    expect(forecast).toHaveLength(5);

    forecast.forEach((day) => {
      expect(day.day).toBeDefined();
      expect(day.date).toBeDefined();
      expect(day.rainfall_mm).toBeGreaterThanOrEqual(0);
      expect(day.icon).toBeDefined();
      expect(['none', 'light', 'moderate', 'heavy', 'extreme']).toContain(day.intensity);
    });
  });

  it('flags warning when rainfall exceeds threshold', () => {
    const forecast = generateForecast(150, 'HIGH');
    const hasWarnings = forecast.some((d) => d.warning);
    expect(hasWarnings).toBe(true);
  });

  it('handles null baseline gracefully by defaulting', () => {
    const forecast = generateForecast(null, null);
    expect(forecast).toHaveLength(5);
  });
});
