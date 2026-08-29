import { describe, it, expect } from 'vitest';
import {
  isAtBaseline,
  envBelongsToZone,
  buildSimulateRequest,
  applySimulationToZones,
} from './scenario';
import { RiskZone, EnvironmentObservation, RiskPredictionResponse } from '../types/api';

describe('Scenario Pure Logic (scenario.ts)', () => {
  const mockEnv: EnvironmentObservation = {
    zone_id: 'gangtok',
    zone_name: 'Gangtok Corridor',
    timestamp: '2026-08-01T06:00:00.000Z',
    rainfall_24h: 85,
    rainfall_3d: 180,
    rainfall_7d: 320,
    soil_moisture: 0.78,
    slope: 35.0,
    source: 'synthetic_seed',
  };

  const mockZones: RiskZone[] = [
    {
      id: 'gangtok',
      region_id: 'sikkim',
      name: 'Gangtok Corridor',
      description: 'Capital area',
      base_slope: 35.0,
      centroid: { latitude: 27.34, longitude: 88.615 },
      geometry: { type: 'Point', coordinates: [88.615, 27.34] },
      risk_score: 0.508,
      risk_level: 'MODERATE',
      timestamp: '2026-08-01T06:00:00.000Z',
      data_source: 'synthetic_seed',
    },
    {
      id: 'mangan',
      region_id: 'sikkim',
      name: 'Mangan Area',
      description: 'North district',
      base_slope: 38.0,
      centroid: { latitude: 27.52, longitude: 88.54 },
      geometry: { type: 'Point', coordinates: [88.54, 27.52] },
      risk_score: 0.56,
      risk_level: 'MODERATE',
      timestamp: '2026-08-01T06:00:00.000Z',
      data_source: 'synthetic_seed',
    },
  ];

  describe('isAtBaseline', () => {
    it('returns true when all values match the observation baseline', () => {
      const values = { rainfall_24h: 85, rainfall_3d: 180, soil_moisture: 0.78 };
      expect(isAtBaseline(values, mockEnv)).toBe(true);
    });

    it('returns false when 24h rainfall differs from baseline', () => {
      const values = { rainfall_24h: 150, rainfall_3d: 180, soil_moisture: 0.78 };
      expect(isAtBaseline(values, mockEnv)).toBe(false);
    });

    it('returns false when 3d rainfall differs from baseline', () => {
      const values = { rainfall_24h: 85, rainfall_3d: 250, soil_moisture: 0.78 };
      expect(isAtBaseline(values, mockEnv)).toBe(false);
    });

    it('returns false when soil moisture differs from baseline', () => {
      const values = { rainfall_24h: 85, rainfall_3d: 180, soil_moisture: 0.95 };
      expect(isAtBaseline(values, mockEnv)).toBe(false);
    });

    it('returns false when observation is null', () => {
      const values = { rainfall_24h: 85, rainfall_3d: 180, soil_moisture: 0.78 };
      expect(isAtBaseline(values, null)).toBe(false);
    });
  });

  describe('envBelongsToZone', () => {
    it('returns true when the observation zone_id matches the zone', () => {
      expect(envBelongsToZone('gangtok', mockEnv)).toBe(true);
    });

    it('returns false for a stale observation belonging to a different zone', () => {
      expect(envBelongsToZone('mangan', mockEnv)).toBe(false);
    });

    it('returns false when zone or observation is null', () => {
      expect(envBelongsToZone(null, mockEnv)).toBe(false);
      expect(envBelongsToZone('gangtok', null)).toBe(false);
      expect(envBelongsToZone(null, null)).toBe(false);
    });
  });

  describe('buildSimulateRequest', () => {
    it('constructs correct request payload with soil_moisture in 0-1 range', () => {
      const values = { rainfall_24h: 150, rainfall_3d: 220, soil_moisture: 0.85 };
      const req = buildSimulateRequest('gangtok', values);

      expect(req).toEqual({
        zone_id: 'gangtok',
        rainfall_24h: 150,
        rainfall_3d: 220,
        soil_moisture: 0.85,
      });
    });
  });

  describe('applySimulationToZones', () => {
    it('returns same array reference when simulation is null', () => {
      const result = applySimulationToZones(mockZones, 'gangtok', null);
      expect(result).toBe(mockZones);
    });

    it('replaces only the target zone risk score and level while preserving other fields and other zones', () => {
      const mockSim: RiskPredictionResponse = {
        zone_id: 'gangtok',
        zone_name: 'Gangtok Corridor',
        risk_score: 0.606,
        risk_level: 'HIGH',
        contributing_factors: [],
        engine: 'deterministic',
        timestamp: '2026-08-29T12:00:00.000Z',
        inputs_used: {
          rainfall_24h: 150,
          rainfall_3d: 180,
          soil_moisture: 0.78,
          slope: 35,
          historical_density: 5,
        },
        data_source: 'synthetic_seed',
      };

      const result = applySimulationToZones(mockZones, 'gangtok', mockSim);

      expect(result).not.toBe(mockZones);
      expect(result).toHaveLength(2);

      // Target zone updated
      expect(result[0].id).toBe('gangtok');
      expect(result[0].risk_score).toBe(0.606);
      expect(result[0].risk_level).toBe('HIGH');
      expect(result[0].description).toBe('Capital area'); // preserved
      expect(result[0].geometry).toEqual(mockZones[0].geometry); // preserved

      // Other zone completely untouched
      expect(result[1]).toEqual(mockZones[1]);
      expect(result[1].risk_score).toBe(0.56);
      expect(result[1].risk_level).toBe('MODERATE');
    });

    it('returns array with unchanged items when zoneId is unknown', () => {
      const mockSim: RiskPredictionResponse = {
        zone_id: 'unknown',
        zone_name: 'Unknown',
        risk_score: 0.9,
        risk_level: 'SEVERE',
        contributing_factors: [],
        engine: 'deterministic',
        timestamp: '2026-08-29T12:00:00.000Z',
        inputs_used: {
          rainfall_24h: 200,
          rainfall_3d: 500,
          soil_moisture: 1,
          slope: 45,
          historical_density: 10,
        },
        data_source: 'synthetic_seed',
      };

      const result = applySimulationToZones(mockZones, 'unknown', mockSim);
      expect(result[0]).toEqual(mockZones[0]);
      expect(result[1]).toEqual(mockZones[1]);
    });
  });
});
