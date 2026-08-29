import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { query } from '../db/query';
import { zoneIdParamSchema } from '../validation/schemas';
import { EnvironmentResponse } from '../types/api';

const router = Router();

/**
 * GET /api/environment/:zoneId
 * Returns the latest environmental telemetry/observation for a specified risk zone.
 */
router.get(
  '/environment/:zoneId',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = zoneIdParamSchema.safeParse(req.params);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid zone ID parameter', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { zoneId } = parseResult.data;

    // 1. Verify that the zone exists
    const zoneCheck = await query<{ id: string; name: string }>(
      'SELECT id, name FROM risk_zones WHERE id = $1;',
      [zoneId]
    );

    if (zoneCheck.rows.length === 0) {
      throw ApiError.notFound(`Risk zone '${zoneId}' not found`, 'ZONE_NOT_FOUND');
    }

    const zoneName = zoneCheck.rows[0].name;

    // 2. Fetch the latest observation
    const obsResult = await query<{
      zone_id: string;
      timestamp: Date | string;
      rainfall_24h: number | null;
      rainfall_3d: number | null;
      rainfall_7d: number | null;
      soil_moisture: number | null;
      slope: number | null;
      source: string;
    }>(
      `
      SELECT zone_id, timestamp, rainfall_24h, rainfall_3d, rainfall_7d,
             soil_moisture, slope, source
      FROM environmental_observations
      WHERE zone_id = $1
      ORDER BY timestamp DESC
      LIMIT 1;
      `,
      [zoneId]
    );

    if (obsResult.rows.length === 0) {
      throw ApiError.notFound(
        `No environmental observation data found for zone '${zoneId}'`,
        'ENVIRONMENT_NOT_FOUND'
      );
    }

    const obs = obsResult.rows[0];
    const response: EnvironmentResponse = {
      zone_id: obs.zone_id,
      zone_name: zoneName,
      timestamp: new Date(obs.timestamp).toISOString(),
      rainfall_24h: obs.rainfall_24h,
      rainfall_3d: obs.rainfall_3d,
      rainfall_7d: obs.rainfall_7d,
      soil_moisture: obs.soil_moisture,
      slope: obs.slope,
      source: obs.source,
    };

    res.json(response);
  })
);

export default router;
