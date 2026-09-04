import express, { Express } from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import regionsRouter from './routes/regions';
import riskZonesRouter from './routes/riskZones';
import eventsRouter from './routes/events';
import environmentRouter from './routes/environment';
import riskRouter from './routes/risk';
import { alertsRouter } from './routes/alerts';
import { copilotRouter } from './routes/copilot';
import modelValidationRouter from './routes/modelValidation';

/**
 * Express application factory.
 * Configures middleware, API routes under /api, and centralized error handling.
 * Exported as a factory function to allow lightweight in-process testing.
 */
export function createApp(): Express {
  const app = express();

  // --- Core Middleware ---
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));

  // --- API Routes ---
  app.use('/api', healthRouter);
  app.use('/api', regionsRouter);
  app.use('/api', riskZonesRouter);
  app.use('/api', eventsRouter);
  app.use('/api', environmentRouter);
  app.use('/api', riskRouter);
  app.use('/api', alertsRouter);
  app.use('/api', copilotRouter);
  app.use('/api', modelValidationRouter);

  // --- Centralized Error Handling (must be registered last) ---
  app.use(errorHandler);

  return app;
}
