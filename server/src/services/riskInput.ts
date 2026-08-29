import { RiskInput } from './riskEngine';

export interface ObservationRow {
  rainfall_24h: number | null;
  rainfall_3d: number | null;
  soil_moisture: number | null;
  slope: number | null;
  source: string;
}

export type RiskOverrides = Partial<
  Pick<RiskInput, 'rainfall_24h' | 'rainfall_3d' | 'soil_moisture' | 'slope' | 'historical_density'>
>;

export type ResolveResult =
  | { ok: true; input: RiskInput }
  | { ok: false; missing: string[] };

/**
 * Pure function resolving environmental inputs by combining:
 * 1. Request overrides (highest priority, e.g. from rainfall slider)
 * 2. Latest stored environmental observation
 * 3. Zone's base_slope (fallback if slope observation is missing)
 * 4. Spatially computed historical event count (for historical_density)
 */
export function resolveRiskInput(
  obs: ObservationRow | null,
  baseSlope: number | null,
  eventCount: number,
  overrides: RiskOverrides = {}
): ResolveResult {
  const rainfall_24h = overrides.rainfall_24h ?? obs?.rainfall_24h ?? null;
  const rainfall_3d = overrides.rainfall_3d ?? obs?.rainfall_3d ?? null;
  const soil_moisture = overrides.soil_moisture ?? obs?.soil_moisture ?? null;
  const slope = overrides.slope ?? obs?.slope ?? baseSlope ?? null;
  const historical_density = overrides.historical_density ?? eventCount;

  const missing: string[] = [];
  if (rainfall_24h === null) missing.push('rainfall_24h');
  if (rainfall_3d === null) missing.push('rainfall_3d');
  if (soil_moisture === null) missing.push('soil_moisture');
  if (slope === null) missing.push('slope');

  if (
    missing.length > 0 ||
    rainfall_24h === null ||
    rainfall_3d === null ||
    soil_moisture === null ||
    slope === null
  ) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    input: {
      rainfall_24h,
      rainfall_3d,
      soil_moisture,
      slope,
      historical_density,
    },
  };
}
