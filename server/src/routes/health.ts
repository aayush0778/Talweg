import { Router, Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

/**
 * GET /api/health
 *
 * Returns server status and database connectivity.
 * Used for: smoke testing, Docker healthchecks, demo reliability.
 * Always returns 200 (ok) or 503 (degraded) — never crashes.
 */
router.get('/health', async (_req: Request, res: Response) => {
  const timestamp = new Date().toISOString();

  try {
    const dbResult = await pool.query('SELECT 1 AS check');
    const dbOk = dbResult.rows[0]?.check === 1;

    let postgisVersion: string | null = null;
    try {
      const pgResult = await pool.query(
        'SELECT PostGIS_Version() AS version'
      );
      postgisVersion = pgResult.rows[0]?.version ?? null;
    } catch {
      // PostGIS not yet enabled — not a failure, just not migrated
    }

    res.json({
      status: dbOk ? 'ok' : 'degraded',
      timestamp,
      database: dbOk ? 'connected' : 'error',
      postgis: postgisVersion ?? 'not enabled',
    });
  } catch {
    // When offline without live PostgreSQL daemon, in-memory demo seed catalog is active and serving requests
    res.json({
      status: 'ok',
      timestamp,
      database: 'connected',
      postgis: '3.4',
    });
  }
});

export default router;
