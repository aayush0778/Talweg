import { RiskZone, EnvironmentObservation, RiskPredictionResponse, SimulateRiskRequest } from '../types/api';

export interface ScenarioValues {
  rainfall_24h: number; // mm (0–200)
  rainfall_3d: number; // mm (0–500)
  soil_moisture: number; // 0–1 (UI displays %)
}

export function isAtBaseline(v: ScenarioValues, env: EnvironmentObservation | null): boolean {
  if (!env) return false;
  return (
    v.rainfall_24h === env.rainfall_24h &&
    v.rainfall_3d === env.rainfall_3d &&
    v.soil_moisture === env.soil_moisture
  );
}

export function buildSimulateRequest(zoneId: string, v: ScenarioValues): SimulateRiskRequest {
  return {
    zone_id: zoneId,
    rainfall_24h: v.rainfall_24h,
    rainfall_3d: v.rainfall_3d,
    soil_moisture: v.soil_moisture, // already 0–1 — do NOT convert here
  };
}

export function applySimulationToZones(
  zones: RiskZone[],
  zoneId: string,
  sim: RiskPredictionResponse | null
): RiskZone[] {
  if (!sim || !zones) return zones; // same reference → React memo stable
  return zones.map((z) =>
    z.id === zoneId
      ? { ...z, risk_score: sim.risk_score, risk_level: sim.risk_level }
      : z
  );
}
