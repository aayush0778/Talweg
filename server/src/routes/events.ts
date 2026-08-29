import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { query } from '../db/query';
import { eventsQuerySchema } from '../validation/schemas';
import { LandslideEventResponse } from '../types/api';

const router = Router();

/**
 * GET /api/events
 * Returns historical landslide events with optional filtering by region or risk zone.
 */
router.get(
  '/events',
  asyncHandler(async (req: Request, res: Response) => {
    const parseResult = eventsQuerySchema.safeParse(req.query);
    if (!parseResult.success) {
      throw ApiError.badRequest('Invalid query parameters', 'VALIDATION_ERROR', parseResult.error.format());
    }

    const { zone_id, region_id, limit } = parseResult.data;

    // If zone_id is specified, verify that the zone actually exists
    if (zone_id) {
      const zoneCheck = await query<{ id: string }>('SELECT id FROM risk_zones WHERE id = $1', [zone_id]);
      if (zoneCheck.rows.length === 0) {
        throw ApiError.notFound(`Risk zone '${zone_id}' not found`, 'ZONE_NOT_FOUND');
      }
    }

    const sql = `
      SELECT e.id,
             to_char(e.date, 'YYYY-MM-DD') AS date,
             e.latitude, e.longitude, e.trigger, e.category,
             e.fatalities, e.description, e.source,
             ST_AsGeoJSON(e.geometry)::json AS geometry
      FROM landslide_events e
      LEFT JOIN risk_zones z ON ST_Contains(z.geometry, e.geometry)
      LEFT JOIN regions r   ON ST_Contains(r.geometry, e.geometry)
      WHERE ($1::text IS NULL OR z.id = $1)
        AND ($2::text IS NULL OR r.id = $2)
      ORDER BY e.date DESC
      LIMIT $3;
    `;

    const result = await query<{
      id: string;
      date: string;
      latitude: number;
      longitude: number;
      trigger: string | null;
      category: string | null;
      fatalities: number | null;
      description: string | null;
      source: string;
      geometry: LandslideEventResponse['geometry'];
    }>(sql, [zone_id || null, region_id || null, limit]);

    const events: LandslideEventResponse[] = result.rows.map((row) => ({
      id: row.id,
      date: row.date,
      latitude: row.latitude,
      longitude: row.longitude,
      trigger: row.trigger,
      category: row.category,
      fatalities: row.fatalities,
      description: row.description,
      source: row.source,
      geometry: row.geometry,
    }));

    res.json(events);
  })
);

export default router;
