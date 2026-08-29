import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root (one level up from server/)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/slopeguard_dev',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  riskEngineMode: (process.env.RISK_ENGINE_MODE || 'deterministic') as
    | 'deterministic'
    | 'ml',
  llmApiKey: process.env.LLM_API_KEY || '',
  llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  llmModel: process.env.LLM_MODEL || 'gpt-4o-mini',
  copilotTimeoutMs: parseInt(process.env.COPILOT_TIMEOUT_MS || '8000', 10),
} as const;
