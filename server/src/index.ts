import express from 'express';
import cors from 'cors';
import { config } from './config';
import { testConnection } from './db';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';

const app = express();

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Routes ---
app.use('/api', healthRouter);

// --- Error handling (must be registered last) ---
app.use(errorHandler);

// --- Startup ---
async function start(): Promise<void> {
  try {
    await testConnection();
  } catch (err) {
    console.warn(
      '[server] Database not available at startup — health endpoint will report degraded status.',
      err instanceof Error ? err.message : err
    );
  }

  app.listen(config.port, () => {
    console.log(`[server] SlopeGuard API running on http://localhost:${config.port}`);
    console.log(`[server] Environment: ${config.nodeEnv}`);
    console.log(`[server] Risk engine mode: ${config.riskEngineMode}`);
  });
}

start();
