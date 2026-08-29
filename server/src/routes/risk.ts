import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { query } from '../db/query';
import { riskBodySchema } from '../validation/schemas';
import { calculateRisk } from '../services/riskEngine';
import { resolveRiskInput, ObservationRow } from '../services/riskInput';
import { RiskPredictionResponse } from '../types/api';

const router = Router();

async function computeZoneRisk(body: unknown): Promise<RiskPredictionResponse> {
  const parseResult = riskBodySchema.safeParse(body);
  if (!parseResult.success) {
    throw ApiError.badRequest('Invalid risk calculation payload', 'VALIDATION_ERROR', parseResult.error.format());
  }

  const { zone_id, ...overrides } = parseResult.data;

  // 1. Fetch risk zone details
  const zoneResult = await query<{ id: string; name: string; base_slope: number | null }>(
    'SELECT id, name, base_slope FROM risk_zones WHERE id = $1;',
    [zone_id]
  );

  if (zoneResult.rows.length === 0) {
    throw ApiError.notFound(`Risk zone '${zone_id}' not found`, 'ZONE_NOT_FOUND');
  }

  const zone = zoneResult.rows[0];

  // 2. Fetch latest stored environmental observation
  const obsResult = await query<ObservationRow>(
    `
    SELECT rainfall_24h, rainfall_3d, soil_moisture, slope, source
    FROM environmental_observations
    WHERE zone_id = $1
    ORDER BY timestamp DESC
    LIMIT 1;
    `,
    [zone_id]
  );

  const obsRow: ObservationRow | null = obsResult.rows[0] ?? null;

  // 3. Count historical events within the zone polygon
  const densityResult = await query<{ event_count: number }>(
    `
    SELECT COUNT(*)::int AS event_count
    FROM landslide_events e, risk_zones z
    WHERE z.id = $1 AND ST_Contains(z.geometry, e.geometry);
    `,
    [zone_id]
  );

  const eventCount = densityResult.rows[0]?.event_count ?? 0;

  // 4. Resolve input (overrides ?? observation ?? base_slope ?? eventCount)
  const resolved = resolveRiskInput(obsRow, zone.base_slope, eventCount, overrides);

  if (!resolved.ok) {
    throw ApiError.notFound(
      `Insufficient environmental observation data for zone '${zone_id}'. Missing: ${resolved.missing.join(', ')}`,
      'ENVIRONMENT_NOT_FOUND'
    );
  }

  // 5. Calculate risk deterministically in-process
  const calc = calculateRisk(resolved.input);

  // 6. Determine data source provenance
  const hasUserOverrides =
    overrides.rainfall_24h !== undefined ||
    overrides.rainfall_3d !== undefined ||
    overrides.soil_moisture !== undefined ||
    overrides.slope !== undefined;

  const dataSource = hasUserOverrides && !obsRow ? 'user_provided' : (obsRow?.source ?? 'synthetic_seed');

  return {
    zone_id: zone.id,
    zone_name: zone.name,
    risk_score: calc.risk_score,
    risk_level: calc.risk_level,
    contributing_factors: calc.contributing_factors,
    engine: calc.engine,
    timestamp: new Date().toISOString(),
    inputs_used: resolved.input,
    data_source: dataSource,
  };
}

/**
 * POST /api/risk/predict
 * Calculate current or parameterized risk for a zone.
 */
router.post(
  '/risk/predict',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await computeZoneRisk(req.body);
    res.json(result);
  })
);

/**
 * POST /api/risk/simulate
 * What-if scenario simulation (e.g. dragging rainfall slider).
 * Operationally identical to /predict with explicit parameter overrides.
 */
router.post(
  '/risk/simulate',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await computeZoneRisk(req.body);
    res.json(result);
  })
);

export default router;
