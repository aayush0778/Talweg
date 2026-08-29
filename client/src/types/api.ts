import type { Geometry } from 'geojson';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';

export type GeoJsonGeometry = Geometry;

export interface Region {
  id: string;
  name: string;
  state: string;
  bounds: [number, number, number, number]; // [minX, minY, maxX, maxY]
  geometry: GeoJsonGeometry;
}

export interface RiskZoneCentroid {
  latitude: number;
  longitude: number;
}

export interface RiskZone {
  id: string;
  region_id: string;
  name: string;
  description: string | null;
  base_slope: number | null;
  centroid: RiskZoneCentroid;
  geometry: GeoJsonGeometry;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  timestamp: string | null;
  data_source: string | null;
}

export interface LandslideEvent {
  id: string;
  date: string; // YYYY-MM-DD
  latitude: number;
  longitude: number;
  trigger: string | null;
  category: string | null;
  fatalities: number | null;
  description: string | null;
  source: string;
  geometry: GeoJsonGeometry;
}

export interface EnvironmentObservation {
  zone_id: string;
  zone_name: string;
  timestamp: string;
  rainfall_24h: number | null;
  rainfall_3d: number | null;
  rainfall_7d: number | null;
  soil_moisture: number | null;
  slope: number | null;
  source: string;
}

export interface FactorContribution {
  factor: string;
  raw: number;
  normalized: number;
  weight: number;
  contribution: number;
}

export interface RiskPredictionInputs {
  rainfall_24h: number;
  rainfall_3d: number;
  soil_moisture: number;
  slope: number;
  historical_density: number;
}

export interface RiskPredictionResponse {
  zone_id: string;
  zone_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  contributing_factors: FactorContribution[];
  engine: 'deterministic' | 'ml';
  timestamp: string;
  inputs_used: RiskPredictionInputs;
  data_source: string;
}

export interface SimulateRiskRequest {
  zone_id: string;
  rainfall_24h?: number;
  rainfall_3d?: number;
  soil_moisture?: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  database: 'connected' | 'disconnected';
  postgis?: string;
}

export interface ApiErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
  };
}
