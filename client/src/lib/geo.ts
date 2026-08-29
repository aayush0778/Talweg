import type { FeatureCollection, Point, Geometry, GeoJsonProperties } from 'geojson';
import { RiskZone, LandslideEvent } from '../types/api';

export function toZoneFeatureCollection(
  zones: RiskZone[]
): FeatureCollection<Geometry, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      id: z.id,
      geometry: z.geometry,
      properties: {
        id: z.id,
        name: z.name,
        region_id: z.region_id,
        risk_level: z.risk_level ?? 'NONE',
        risk_score: z.risk_score,
        data_source: z.data_source,
      },
    })),
  };
}

export function toEventFeatureCollection(
  events: LandslideEvent[]
): FeatureCollection<Geometry, GeoJsonProperties> {
  return {
    type: 'FeatureCollection',
    features: events.map((e) => ({
      type: 'Feature',
      id: e.id,
      geometry: e.geometry,
      properties: {
        id: e.id,
        date: e.date,
        latitude: e.latitude,
        longitude: e.longitude,
        trigger: e.trigger,
        category: e.category,
        fatalities: e.fatalities,
        description: e.description,
        source: e.source,
      },
    })),
  };
}

export function toZoneLabelFeatures(
  zones: RiskZone[]
): FeatureCollection<Point, { id: string; name: string }> {
  return {
    type: 'FeatureCollection',
    features: zones.map((z) => ({
      type: 'Feature',
      id: `label-${z.id}`,
      geometry: {
        type: 'Point',
        // GeoJSON standard: [longitude, latitude]
        coordinates: [z.centroid.longitude, z.centroid.latitude],
      },
      properties: {
        id: z.id,
        name: z.name,
      },
    })),
  };
}
