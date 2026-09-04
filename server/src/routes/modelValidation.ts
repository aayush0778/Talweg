import { Router, Request, Response } from 'express';
import { runModelValidationBacktest } from '../services/modelValidation';

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

export default router;
