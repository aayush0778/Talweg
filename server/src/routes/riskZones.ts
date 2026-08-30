import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { query } from '../db/query';
import { zonesQuerySchema, idParamSchema } from '../validation/schemas';
import { evaluateRisk } from '../services/riskEvaluator';
import { resolveRiskInput, ObservationRow } from '../services/riskInput';
import { RiskZoneResponse } from '../types/api';

const router = Router();

interface RiskZoneRow {
  id: string;
  region_id: string;
  name: string;
  description: string | null;
  base_slope: number | null;
  geometry: RiskZoneResponse['geometry'];
  centroid_lat: number;
  centroid_lng: number;
  rainfall_24h: number | null;
  rainfall_3d: number | null;
  rainfall_7d: number | null;
  soil_moisture: number | null;
  obs_slope: number | null;
  obs_timestamp: Date | string | null;
  obs_source: string | null;
  historical_density: number;
}

async function mapRowToResponse(row: RiskZoneRow): Promise<RiskZoneResponse> {
  let riskScore: number | null = null;
  let riskLevel: RiskZoneResponse['risk_level'] = null;

  const obs: ObservationRow | null = row.obs_source
    ? {
        rainfall_24h: row.rainfall_24h,
        rainfall_3d: row.rainfall_3d,
        soil_moisture: row.soil_moisture,
        slope: row.obs_slope,
        source: row.obs_source,
      }
    : null;

  const resolved = resolveRiskInput(obs, row.base_slope, row.historical_density, {});
  if (resolved.ok) {
    const calc = await evaluateRisk(resolved.input);
    riskScore = calc.risk_score;
    riskLevel = calc.risk_level;
  }

  return {
    id: row.id,
    region_id: row.region_id,
    name: row.name,
    description: row.description,
    base_slope: row.base_slope,
    centroid: {
      latitude: row.centroid_lat,
      longitude: row.centroid_lng,
    },
    geometry: row.geometry,
    risk_score: riskScore,
    risk_level: riskLevel,
    timestamp: row.obs_timestamp ? new Date(row.obs_timestamp).toISOString() : null,
    data_source: row.obs_source || null,
  };
}

const BASE_ZONE_QUERY = `
  SELECT
    z.id, z.region_id, z.name, z.description, z.base_slope,
    ST_AsGeoJSON(z.geometry)::json AS geometry,
    ST_Y(ST_Centroid(z.geometry)) AS centroid_lat,
    ST_X(ST_Centroid(z.geometry)) AS centroid_lng,
    obs.rainfall_24h, obs.rainfall_3d, obs.rainfall_7d,
    obs.soil_moisture, obs.slope AS obs_slope,
    obs.timestamp AS obs_timestamp, obs.source AS obs_source,
    COALESCE(ev.event_count, 0) AS historical_density
  FROM risk_zones z
  LEFT JOIN LATERAL (
    SELECT rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, timestamp, source
    FROM environmental_observations o
    WHERE o.zone_id = z.id
    ORDER BY o.timestamp DESC
    LIMIT 1
  ) obs ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS event_count
    FROM landslide_events e
    WHERE ST_Contains(z.geometry, e.geometry)
  ) ev ON true
`;

/**
 * GET /api/risk-zones
 * Returns all risk zones with their latest environmental assessment and risk level.
 * Uses Promise.all to parallelize evaluations across zones within a single timeout window.
 */
router.get(
  '/risk-zones',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = zonesQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { region_id } = parseResult.data;
    const sql = `${BASE_ZONE_QUERY} WHERE ($1::text IS NULL OR z.region_id = $1) ORDER BY z.name;`;
    const result = await query<RiskZoneRow>(sql, [region_id || null]);

    const zones: RiskZoneResponse[] = await Promise.all(result.rows.map(mapRowToResponse));
    res.json(zones);
  })
);

/**
 * GET /api/risk-zones/:id
 * Returns detail and current assessment for a single risk zone.
 */
router.get(
  '/risk-zones/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = idParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid zone ID parameter', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { id } = parseResult.data;
    const sql = `${BASE_ZONE_QUERY} WHERE z.id = $1;`;
    const result = await query<RiskZoneRow>(sql, [id]);

    if (result.rows.length === 0) {
      throw ApiError.notFound(`Risk zone '${id}' not found`, 'ZONE_NOT_FOUND');
    }

    const zone = await mapRowToResponse(result.rows[0]);
    res.json(zone);
  })
);

export default router;
