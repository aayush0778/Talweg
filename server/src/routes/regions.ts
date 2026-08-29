import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { query } from '../db/query';
import { RegionResponse } from '../types/api';

const router = Router();

/**
 * GET /api/regions
 * Returns all monitored regions with their GeoJSON geometry and bounding box.
 */
router.get(
  '/regions',
  asyncHandler(async (_req: Request, res: Response) => {
    const result = await query<{
      id: string;
      name: string;
      state: string;
      geometry: RegionResponse['geometry'];
      min_x: number;
      min_y: number;
      max_x: number;
      max_y: number;
    }>(`
      SELECT id, name, state,
             ST_AsGeoJSON(geometry)::json AS geometry,
             ST_XMin(geometry) AS min_x, ST_YMin(geometry) AS min_y,
             ST_XMax(geometry) AS max_x, ST_YMax(geometry) AS max_y
      FROM regions
      ORDER BY name;
    `);

    const regions: RegionResponse[] = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      state: row.state,
      bounds: [row.min_x, row.min_y, row.max_x, row.max_y],
      geometry: row.geometry,
    }));

    res.json(regions);
  })
);

export default router;
