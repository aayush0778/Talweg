import { Router, Request, Response, NextFunction } from 'express';
import { getZoneWeatherForecast } from '../services/weatherForecast';

const router = Router();

/**
 * GET /api/forecast/:zoneId
 * Returns 5-day weather precipitation forecast with live IMD/NCMRWF data or resilient fallback.
 */
router.get('/forecast/:zoneId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { zoneId } = req.params;
    const baseRain = req.query.rainfall_24h ? Number(req.query.rainfall_24h) : undefined;
    const forecast = await getZoneWeatherForecast(zoneId, isNaN(baseRain as number) ? undefined : baseRain);
    res.json(forecast);
  } catch (err) {
    next(err);
  }
});

export default router;
