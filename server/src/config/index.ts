import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (one level up from server/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Railway's / Render's private network uses just the hostname (no http:// prefix)
// Build full URL here:
const mlHost = process.env.ML_SERVICE_URL || 'localhost';
const ML_SERVICE_URL = mlHost.startsWith('http')
  ? mlHost
  : `http://${mlHost}:${process.env.ML_SERVICE_PORT || '8000'}`;

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/slopeguard_dev',
  mlServiceUrl: ML_SERVICE_URL,
  mlTimeoutMs: parseInt(process.env.ML_TIMEOUT_MS || '1000', 10),
  riskEngineMode: (process.env.RISK_ENGINE_MODE || 'deterministic') as
    | 'deterministic'
    | 'ml',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  copilotTimeoutMs: parseInt(process.env.COPILOT_TIMEOUT_MS || '8000', 10),
} as const;
