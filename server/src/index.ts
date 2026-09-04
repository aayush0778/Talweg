import { config } from './config';
import { testConnection } from './db';
import { createApp } from './app';

const app = createApp();

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

  const PORT = parseInt(process.env.PORT || String(config.port), 10);
  const HOST = '0.0.0.0'; // REQUIRED — not 'localhost' or '127.0.0.1'

  app.listen(PORT, HOST, () => {
    console.log(`Server listening on ${HOST}:${PORT}`);
    console.log(`NODE_ENV: ${process.env.NODE_ENV || config.nodeEnv}`);
    console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'MISSING'}`);
    console.log(`Risk engine mode: ${config.riskEngineMode}`);
  });
}

start();
