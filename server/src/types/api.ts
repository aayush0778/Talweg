import { FactorContribution, RiskLevel } from '../services/riskEngine';

export interface GeoJsonGeometry {
  type: 'Polygon' | 'MultiPolygon' | 'Point' | 'LineString' | string;
  coordinates: unknown;
}

export interface RegionResponse {
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

export interface RiskZoneResponse {
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

export interface LandslideEventResponse {
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

export interface EnvironmentResponse {
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

export interface AlertResponse {
  id: number;
  zone_id: string;
  zone_name: string;
  severity: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
  risk_score: number;
  message: string;
  evidence: Record<string, unknown> | null;
  status: 'active' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface CopilotAskRequest {
  zone_id: string;
  question: string;
}

export interface CopilotResponse {
  answer: string;
  evidence: {
    zone_id: string;
    zone_name: string;
    risk_score: number | null;
    risk_level: string | null;
    top_factors: { factor: string; contribution: number }[];
    recent_events: { date: string; description: string | null }[];
    data_source: string;
  };
  source: 'llm' | 'deterministic';
  timestamp: string;
}

// ----- Data Provenance (Phase P0) -----

export type DataProvenance = 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'SIMULATED';

export interface ProvenanceInfo {
  type: DataProvenance;
  source?: string;
  sourceUrl?: string;
  note?: string;
}

export interface ProvenanceWrapped<T> {
  value: T;
  provenance: ProvenanceInfo;
}

export interface HistoricalReplayEvent {
  date: string;
  latitude: number;
  longitude: number;
  category: string;
  description: string;
  source: ProvenanceInfo;
}

export interface HistoricalReplayInputs {
  rainfall_24h: ProvenanceWrapped<number | null>;
  rainfall_3d: ProvenanceWrapped<number | null>;
  rainfall_7d: ProvenanceWrapped<number | null>;
  soil_moisture: ProvenanceWrapped<number | null>;
  slope: ProvenanceWrapped<number | null>;
  historical_density: ProvenanceWrapped<number | null>;
}

export interface HistoricalReplayTalweg {
  risk_score: number;
  risk_level: RiskLevel;
  engine: 'deterministic' | 'ml';
  flagged: boolean;
  contributing_factors: Array<{ factor: string; contribution: number }>;
}

export interface HistoricalReplayValidation {
  status: 'real_replay' | 'methodology_only' | 'synthetic_demo';
  caveat: string;
}

export interface HistoricalReplayResponse {
  id: string;
  event: HistoricalReplayEvent;
  inputs: HistoricalReplayInputs;
  talweg: HistoricalReplayTalweg;
  validation: HistoricalReplayValidation;
}

export interface HistoricalReplayListItem {
  id: string;
  event_id: string | null;
  event_date: string;
  latitude: number;
  longitude: number;
  zone_id: string | null;
  source: string;
  data_quality: string;
  actual_event: boolean;
  data_notes: string | null;
}

export interface ValidationSummaryResponse {
  status: 'validated' | 'methodology_only';
  real_replay_count: number;
  synthetic_replay_count: number;
  methodology_count: number;
  metrics: {
    precision: number;
    recall: number;
    f1: number;
    confusion_matrix: { tp: number; fp: number; fn: number; tn: number };
  } | null;
  reason?: string;
}

// ----- Hazard Progression & Predictive Runout Replay -----

export type HazardProgressionPhase = 'T-72h' | 'T-48h' | 'T-24h' | 'T-6h' | 'EVENT';

export interface HazardTimelineStep {
  phase: HazardProgressionPhase;
  time_offset_hours: number;
  rainfall_24h: number;
  rainfall_3d: number;
  soil_moisture: number;
  risk_score: number;
  risk_level: RiskLevel;
  flow_progress: number;
  stage_title: string;
  stage_description: string;
  threshold_crossed: boolean;
}

export interface HazardCorridorGeometry {
  initiation_point: [number, number, number]; // [lon, lat, elev_m]
  flow_path: Array<[number, number, number]>; // [lon, lat, elev_m]
  corridor_polygon: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: Record<string, unknown>;
  };
  deposition_polygon: {
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: number[][][];
    };
    properties: Record<string, unknown>;
  };
  historical_event_point: [number, number]; // [lon, lat]
}

export interface HazardProgressionResponse {
  replay_id: string;
  event_name: string;
  event_date: string;
  zone_id: string;
  zone_name: string;
  simulation_mode?: 'historical_replay' | 'predictive_runout';
  provenance_type?: 'REAL' | 'DERIVED' | 'SYNTHETIC' | 'SIMULATED';
  geometry: HazardCorridorGeometry;
  timeline: HazardTimelineStep[];
  disclaimer: string;
}

// ----- Weather Forecast (Live IMD / NCMRWF with Fallback) -----

export interface WeatherForecastDay {
  date: string; // YYYY-MM-DD
  day: string; // 'Mon', 'Tue', etc.
  rainfall_mm: number;
  probability_pct?: number;
  icon: string;
  intensity: 'none' | 'light' | 'moderate' | 'heavy' | 'very_heavy' | 'extreme';
  warning: boolean;
}

export interface ZoneForecastResponse {
  zone_id: string;
  zone_name: string;
  forecast_days: WeatherForecastDay[];
  provenance: ProvenanceInfo;
  fetched_at: string;
}
