import { Router, Request, Response, NextFunction } from 'express';
import { runModelValidationBacktest } from '../services/modelValidation';
import { buildValidationSummary } from '../services/historicalReplay';

/**
 * GET /api/model-validation
 *
 * Runs the historical-event backtest (see services/modelValidation.ts and
 * services/backtestScenarios.ts for full methodology and caveats) and
 * returns the summary. Computed on-the-fly from the pure deterministic
 * engine — no database call, no caching needed, always current.
 */
const router = Router();

router.get('/model-validation', (_req: Request, res: Response) => {
  const summary = runModelValidationBacktest();
  res.json(summary);
});

// New: validation summary with real vs synthetic counts
router.get('/model-validation/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await buildValidationSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
