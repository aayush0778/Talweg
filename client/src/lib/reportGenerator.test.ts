import { describe, it, expect } from 'vitest';
import { generateReportHTML } from './reportGenerator';
import type { RiskZone, RiskPredictionResponse, EnvironmentObservation, LandslideEvent } from '../types/api';

describe('generateReportHTML', () => {
  const mockZone: RiskZone = {
    id: 'gangtok',
    region_id: 'sikkim',
    name: 'Gangtok Urban Corridor',
    description: 'Capital municipal area with dense urban slopes.',
    base_slope: 28.5,
    centroid: { latitude: 27.33, longitude: 88.61 },
    geometry: { type: 'Polygon', coordinates: [] },
    risk_score: 0.508,
    risk_level: 'MODERATE',
    timestamp: '2026-08-30T00:00:00Z',
    data_source: 'synthetic_seed',
  };

  const mockPrediction: RiskPredictionResponse = {
    zone_id: 'gangtok',
    zone_name: 'Gangtok Urban Corridor',
    risk_score: 0.508,
    risk_level: 'MODERATE',
    contributing_factors: [
      { factor: 'rainfall_24h', raw: 65, normalized: 0.325, weight: 0.3, contribution: 0.0975 },
      { factor: 'rainfall_3d', raw: 140, normalized: 0.28, weight: 0.2, contribution: 0.056 },
    ],
    engine: 'deterministic',
    timestamp: '2026-08-30T00:00:00Z',
    inputs_used: {
      rainfall_24h: 65,
      rainfall_3d: 140,
      soil_moisture: 0.65,
      slope: 28.5,
      historical_density: 4,
    },
    data_source: 'synthetic_seed',
  };

  const mockEnv: EnvironmentObservation = {
    zone_id: 'gangtok',
    zone_name: 'Gangtok Urban Corridor',
    timestamp: '2026-08-30T00:00:00Z',
    rainfall_24h: 65,
    rainfall_3d: 140,
    rainfall_7d: 210,
    soil_moisture: 0.65,
    slope: 28.5,
    source: 'synthetic_seed',
  };

  const mockEvents: LandslideEvent[] = [
    {
      id: 'evt-1',
      date: '2024-07-12',
      latitude: 27.33,
      longitude: 88.61,
      trigger: 'Rainfall',
      category: 'Debris Flow',
      fatalities: 0,
      description: 'Minor slip along Deorali road.',
      source: 'gsi',
      geometry: { type: 'Point', coordinates: [88.61, 27.33] },
    },
  ];

  it('generates a valid HTML report with zone information', () => {
    const html = generateReportHTML(mockZone, mockPrediction, mockEnv, mockEvents);
    expect(html).toContain('Talweg');
    expect(html).toContain('Gangtok Urban Corridor');
    expect(html).toContain('MODERATE');
    expect(html).toContain('51'); // 0.508 -> 51
    expect(html).toContain('Deorali road');
    expect(html).toContain('24-Hour Rainfall');
    expect(html).toContain('window.print()');
  });

  it('handles null prediction, environment, and events gracefully', () => {
    const html = generateReportHTML(mockZone, null, null, null);
    expect(html).toContain('Gangtok Urban Corridor');
    expect(html).toContain('Factor analysis unavailable');
    expect(html).toContain('No environmental telemetry recorded');
    expect(html).toContain('No historical incidents recorded');
  });
});
