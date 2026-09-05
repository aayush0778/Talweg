import { Router, Request, Response, NextFunction } from 'express';
import {
  listHistoricalReplays,
  getHistoricalReplayById,
  replayHistoricalEvent,
} from '../services/historicalReplay';

const router = Router();

/**
 * GET /api/historical-replays
 * List all historical replay records with metadata.
 */
router.get('/historical-replays', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const replays = await listHistoricalReplays();
    res.json(replays);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/historical-replays/:id
 * Get a single historical replay record.
 */
router.get('/historical-replays/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const record = await getHistoricalReplayById(req.params.id);
    if (!record) {
      res.status(404).json({ error: { message: 'Historical replay record not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json(record);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/historical-replays/:id/replay
 * Run a full replay calculation for a historical event.
 * Returns event metadata, input vector with provenance, TALWEG assessment, and validation caveat.
 */
router.get('/historical-replays/:id/replay', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await replayHistoricalEvent(req.params.id);
    if (!result) {
      res.status(404).json({ error: { message: 'Historical replay record not found', code: 'NOT_FOUND' } });
      return;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
