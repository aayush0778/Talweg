/**
 * Zone Risk Input Resolver (Final Upgrade)
 *
 * Resolves the complete environmental context for a zone:
 *  - latest environmental observation (rainfall 24h/3d/7d, soil moisture, slope)
 *  - base slope from zone geometry (DEM-derived)
 *  - historical event density (spatial count)
 *  - provenance class per feature
 *
 * Works against Postgres when available and degrades to the in-memory
 * demo catalog when the database is offline (parity with db/query.ts).
 */

import { query } from '../db/query';
import { isDbError } from '../db/query';
import { FALLBACK_ZONES } from '../db/fallbackData';
import { RiskInput } from './riskEngine';
import { ProvenanceType } from '../schemas/featureSchema';

export interface ZoneEnvironmentContext {
  zone_id: string;
  zone_name: string;
  base_slope: number | null;
  centroid: { latitude: number; longitude: number } | null;
  obs: {
    timestamp: string | null;
    rainfall_24h: number | null;
    rainfall_3d: number | null;
    rainfall_7d: number | null;
    soil_moisture: number | null;
    slope: number | null;
    source: string | null;
  } | null;
  event_count: number;
  /** in-memory demo mode active (DB unreachable) */
  fallback_mode: boolean;
}

export interface ResolvedZoneRisk {
  ok: boolean;
  missing: string[];
  context: ZoneEnvironmentContext | null;
  input: RiskInput | null;
  provenanceByFeature: Record<string, ProvenanceType>;
  rainfallProvenance: 'REAL' | 'DERIVED' | 'SYNTHETIC';
  rainfallSourceId: string;
}

export type RiskInputOverrides = Partial<
  Pick<RiskInput, 'rainfall_24h' | 'rainfall_3d' | 'rainfall_5d' | 'rainfall_7d' | 'soil_moisture' | 'slope' | 'historical_density'>
>;

function provenanceFromSource(source: string | null | undefined): ProvenanceType {
  if (!source) return 'UNKNOWN';
  const s = source.toLowerCase();
  if (s.includes('synthetic') || s.includes('demo')) return 'SYNTHETIC';
  if (s.includes('chirps') || s.includes('imd') || s.includes('glc') || s.includes('real')) return 'REAL';
  return 'DERIVED';
}

async function fetchContext(zoneId: string): Promise<ZoneEnvironmentContext | null> {
  try {
    const zoneRes = await query<{
      id: string; name: string; base_slope: number | null; lat: number | null; lng: number | null;
    }>(
      `SELECT id, name, base_slope,
              ST_Y(ST_Centroid(geometry)) AS lat,
              ST_X(ST_Centroid(geometry)) AS lng
       FROM risk_zones WHERE id = $1;`,
      [zoneId]
    );
    if (zoneRes.rows.length === 0) return null;
    const zone = zoneRes.rows[0];

    const obsRes = await query<{
      timestamp: Date | string; rainfall_24h: number | null; rainfall_3d: number | null;
      rainfall_7d: number | null; soil_moisture: number | null; slope: number | null; source: string;
    }>(
      `SELECT timestamp, rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, source
       FROM environmental_observations WHERE zone_id = $1
       ORDER BY timestamp DESC LIMIT 1;`,
      [zoneId]
    );

    const densityRes = await query<{ event_count: number }>(
      `SELECT COUNT(*)::int AS event_count
       FROM landslide_events e, risk_zones z
       WHERE z.id = $1 AND ST_Contains(z.geometry, e.geometry);`,
      [zoneId]
    );

    const o = obsRes.rows[0];
    return {
      zone_id: zone.id,
      zone_name: zone.name,
      base_slope: zone.base_slope ?? null,
      centroid:
        zone.lat !== null && zone.lng !== null
          ? { latitude: Number(zone.lat), longitude: Number(zone.lng) }
          : null,
      obs: o
        ? {
            timestamp: new Date(o.timestamp).toISOString(),
            rainfall_24h: o.rainfall_24h,
            rainfall_3d: o.rainfall_3d,
            rainfall_7d: o.rainfall_7d,
            soil_moisture: o.soil_moisture,
            slope: o.slope,
            source: o.source,
          }
        : null,
      event_count: densityRes.rows[0]?.event_count ?? 0,
      fallback_mode: false,
    };
  } catch (err) {
    // DB unreachable: query() maps raw connection errors to ApiError('DATABASE_ERROR');
    // both mean "use the in-memory demo catalog".
    const code = (err as { code?: string })?.code;
    if (!isDbError(err) && code !== 'DATABASE_ERROR' && code !== '42P01' && code !== '42703') throw err;
    // In-memory demo catalog
    const z = FALLBACK_ZONES.find((zone) => zone.id === zoneId);
    if (!z) return null;
    return {
      zone_id: z.id,
      zone_name: z.name,
      base_slope: z.base_slope ?? null,
      centroid: { latitude: z.centroid_lat, longitude: z.centroid_lng },
      obs: {
        timestamp: z.obs_timestamp,
        rainfall_24h: z.rainfall_24h,
        rainfall_3d: z.rainfall_3d,
        rainfall_7d: z.rainfall_7d,
        soil_moisture: z.soil_moisture,
        slope: z.obs_slope,
        source: z.obs_source,
      },
      event_count: z.historical_density,
      fallback_mode: true,
    };
  }
}

/**
 * Resolve the full risk input for a zone with explicit provenance.
 * Overrides win over observations; observations over zone defaults.
 */
export async function resolveZoneRiskInputs(
  zoneId: string,
  overrides: RiskInputOverrides = {}
): Promise<ResolvedZoneRisk> {
  const context = await fetchContext(zoneId);
  if (!context) {
    return { ok: false, missing: ['zone'], context: null, input: null, provenanceByFeature: {}, rainfallProvenance: 'SYNTHETIC', rainfallSourceId: 'seed-telemetry' };
  }

  const obs = context.obs;
  const obsProvenance = provenanceFromSource(obs?.source);

  const rainfall_24h = overrides.rainfall_24h ?? obs?.rainfall_24h ?? null;
  const rainfall_3d = overrides.rainfall_3d ?? obs?.rainfall_3d ?? null;
  const rainfall_5d = overrides.rainfall_5d ?? null; // no 5d telemetry yet — null, never fabricated
  const rainfall_7d = overrides.rainfall_7d ?? obs?.rainfall_7d ?? null;
  const soil_moisture = overrides.soil_moisture ?? obs?.soil_moisture ?? null;
  const slope = overrides.slope ?? obs?.slope ?? context.base_slope ?? null;
  const historical_density = overrides.historical_density ?? context.event_count;

  const missing: string[] = [];
  if (rainfall_24h === null) missing.push('rainfall_24h');
  if (rainfall_3d === null) missing.push('rainfall_3d');
  if (soil_moisture === null) missing.push('soil_moisture');
  if (slope === null) missing.push('slope');

  const provenanceByFeature: Record<string, ProvenanceType> = {
    rainfall_24h: overrides.rainfall_24h !== undefined ? 'SYNTHETIC' : obsProvenance,
    rainfall_3d: overrides.rainfall_3d !== undefined ? 'SYNTHETIC' : obsProvenance,
    soil_moisture: overrides.soil_moisture !== undefined ? 'SYNTHETIC' : obsProvenance,
    slope:
      overrides.slope !== undefined
        ? 'SYNTHETIC'
        : obs?.slope != null
          ? obsProvenance
          : 'DERIVED',
    historical_density: 'DERIVED',
  };

  const input: RiskInput | null =
    missing.length === 0
      ? {
          rainfall_24h: rainfall_24h as number,
          rainfall_3d: rainfall_3d as number,
          rainfall_5d: rainfall_5d ?? undefined,
          rainfall_7d: rainfall_7d ?? undefined,
          soil_moisture: soil_moisture as number,
          slope: slope as number,
          historical_density,
          zone_id: zoneId,
          latitude: context.centroid?.latitude,
          longitude: context.centroid?.longitude,
        }
      : null;

  return {
    ok: missing.length === 0,
    missing,
    context,
    input,
    provenanceByFeature,
    rainfallProvenance:
      overrides.rainfall_24h !== undefined
        ? 'SYNTHETIC'
        : obsProvenance === 'REAL'
          ? 'REAL'
          : obsProvenance === 'DERIVED'
            ? 'DERIVED'
            : 'SYNTHETIC',
    rainfallSourceId: obs?.source?.toLowerCase().includes('chirps') ? 'chirps' : 'seed-telemetry',
  };
}
