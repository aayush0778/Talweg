import { describe, it, expect } from 'vitest';
import type { Point } from 'geojson';
import {
  toZoneFeatureCollection,
  toEventFeatureCollection,
  toZoneLabelFeatures,
} from './geo';
import { RiskZone, LandslideEvent } from '../types/api';

describe('GeoJSON Mappers (geo.ts)', () => {
  const mockZones: RiskZone[] = [
    {
      id: 'gangtok',
      region_id: 'sikkim',
      name: 'Gangtok Corridor',
      description: 'State capital',
      base_slope: 35.0,
      centroid: { latitude: 27.34, longitude: 88.615 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[88.58, 27.3], [88.65, 27.3], [88.65, 27.38], [88.58, 27.38], [88.58, 27.3]]],
      },
      risk_score: 0.508,
      risk_level: 'MODERATE',
      timestamp: '2026-08-01T06:00:00.000Z',
      data_source: 'synthetic_seed',
    },
    {
      id: 'mangan',
      region_id: 'sikkim',
      name: 'Mangan Area',
      description: null,
      base_slope: 38.0,
      centroid: { latitude: 27.52, longitude: 88.54 },
      geometry: {
        type: 'Polygon',
        coordinates: [[[88.5, 27.48], [88.58, 27.48], [88.58, 27.55], [88.5, 27.55], [88.5, 27.48]]],
      },
      risk_score: null,
      risk_level: null,
      timestamp: null,
      data_source: null,
    },
  ];

  const mockEvents: LandslideEvent[] = [
    {
      id: 'evt-001',
      date: '2023-10-04',
      latitude: 27.33,
      longitude: 88.61,
      trigger: 'rain',
      category: 'landslide',
      fatalities: 2,
      description: 'Debris flow along NH10',
      source: 'synthetic_seed',
      geometry: {
        type: 'Point',
        coordinates: [88.61, 27.33],
      },
    },
  ];

  it('converts zones to a GeoJSON FeatureCollection preserving properties and geometry', () => {
    const fc = toZoneFeatureCollection(mockZones);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(2);

    const f1 = fc.features[0];
    expect(f1.id).toBe('gangtok');
    expect(f1.properties?.name).toBe('Gangtok Corridor');
    expect(f1.properties?.risk_level).toBe('MODERATE');
    expect(f1.properties?.risk_score).toBe(0.508);
    expect(f1.geometry).toEqual(mockZones[0].geometry);

    const f2 = fc.features[1];
    expect(f2.id).toBe('mangan');
    expect(f2.properties?.risk_level).toBe('NONE');
    expect(f2.properties?.risk_score).toBeNull();
  });

  it('converts events to a GeoJSON FeatureCollection', () => {
    const fc = toEventFeatureCollection(mockEvents);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);

    const f = fc.features[0];
    expect(f.id).toBe('evt-001');
    expect(f.properties?.date).toBe('2023-10-04');
    expect(f.properties?.fatalities).toBe(2);
    expect(f.geometry).toEqual(mockEvents[0].geometry);
  });

  it('correctly maps zone centroid to GeoJSON Point coordinates [longitude, latitude]', () => {
    const labelFc = toZoneLabelFeatures(mockZones);
    expect(labelFc.type).toBe('FeatureCollection');
    expect(labelFc.features).toHaveLength(2);

    const l1 = labelFc.features[0];
    expect(l1.id).toBe('label-gangtok');
    expect(l1.geometry.type).toBe('Point');
    // GeoJSON coordinate order MUST be [lng, lat]
    const g1 = l1.geometry as Point;
    expect(g1.coordinates).toEqual([88.615, 27.34]);
    expect(l1.properties.name).toBe('Gangtok Corridor');

    const l2 = labelFc.features[1];
    const g2 = l2.geometry as Point;
    expect(g2.coordinates).toEqual([88.54, 27.52]);
  });
});
