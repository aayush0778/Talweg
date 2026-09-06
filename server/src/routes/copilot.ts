/**
 * Copilot Route — POST /api/copilot & POST /api/copilot/ask
 *
 * PRESERVES the existing contract from docs/api_contracts.md.
 * Resolves both /api/copilot and /api/copilot/ask.
 * Supports question / query / prompt request fields and optional zone_id / zoneId.
 * The response ADDS `engine` and `intent` fields (additive, non-breaking).
 *
 * Resolution order:
 *   1. LLM (if LLM_API_KEY configured) — with the user's ACTUAL question
 *      interpolated into the messages array, grounded context in the system
 *      prompt, and a timeout guard.
 *   2. Deterministic engine — intent-routed, context-grounded fallback.
 * The route never 5xx's due to LLM failures; it degrades gracefully.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { config } from '../config';
import { query } from '../db/query';
import {
  CopilotContext,
  CopilotZoneSummary,
  CopilotAlertSummary,
  contextSummaryForLLM,
  deterministicAnswer,
} from '../services/copilotEngine';
import { calculateRisk } from '../services/riskEngine';
import { resolveRiskInput } from '../services/riskInput';
import { ALERT_FACTOR_LABELS } from '../services/alertSync';
import { CopilotResponse } from '../types/api';

export const copilotRouter = Router();

const requestSchema = z.object({
  question: z.string().trim().optional(),
  query: z.string().trim().optional(),
  prompt: z.string().trim().optional(),
  zone_id: z.string().trim().optional(),
  zoneId: z.string().trim().optional(),
});

interface ZoneRow {
  id: string;
  name: string;
  description: string | null;
  base_slope: number | null;
  rainfall_24h: number | null;
  rainfall_3d: number | null;
  rainfall_7d: number | null;
  soil_moisture: number | null;
  obs_slope: number | null;
  obs_source: string | null;
  event_count: number;
}

async function buildCopilotContext(): Promise<{
  ctx: CopilotContext;
  zoneMap: Map<string, ZoneRow & { riskScore: number; riskLevel: string; factors: Array<{ factor: string; contribution: number }> }>;
}> {
  try {
    const zonesResult = await query<ZoneRow>(`
      SELECT
        z.id, z.name, z.description, z.base_slope,
        obs.rainfall_24h, obs.rainfall_3d, obs.rainfall_7d,
        obs.soil_moisture, obs.slope AS obs_slope, obs.source AS obs_source,
        COALESCE(ev.event_count, 0) AS event_count
      FROM risk_zones z
      LEFT JOIN LATERAL (
        SELECT rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, timestamp, source
        FROM environmental_observations o
        WHERE o.zone_id = z.id
        ORDER BY o.timestamp DESC
        LIMIT 1
      ) obs ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS event_count
        FROM landslide_events e
        WHERE ST_Contains(z.geometry, e.geometry)
      ) ev ON true
    `);

    const alertsResult = await query<{
      zone_name: string;
      level: string;
      title: string;
    }>(`
      SELECT z.name AS zone_name, a.severity AS level, a.message AS title
      FROM alerts a
      JOIN risk_zones z ON z.id = a.zone_id
      WHERE a.status = 'active'
      ORDER BY a.created_at DESC
      LIMIT 10
    `);

    const zoneMap = new Map<string, ZoneRow & { riskScore: number; riskLevel: string; factors: Array<{ factor: string; contribution: number }> }>();

    const zones: CopilotZoneSummary[] = zonesResult.rows.map((row) => {
      const resolved = resolveRiskInput(
        row.obs_source
          ? {
              rainfall_24h: row.rainfall_24h,
              rainfall_3d: row.rainfall_3d,
              soil_moisture: row.soil_moisture,
              slope: row.obs_slope,
              source: row.obs_source,
            }
          : null,
        row.base_slope,
        row.event_count,
        {}
      );

      let riskScore = 50;
      let riskLevel = 'Moderate';
      let topFactor: string | undefined;
      let factors: Array<{ factor: string; contribution: number }> = [];

      if (resolved.ok) {
        const calc = calculateRisk(resolved.input);
        riskScore = Math.round(calc.risk_score * 100);
        riskLevel = calc.risk_level;
        factors = calc.contributing_factors.map((f) => ({
          factor: f.factor,
          contribution: f.contribution,
        }));
        if (calc.contributing_factors.length > 0) {
          const top = calc.contributing_factors[0];
          topFactor = ALERT_FACTOR_LABELS[top.factor] || top.factor;
        }
      }

      zoneMap.set(row.id, {
        ...row,
        riskScore,
        riskLevel,
        factors,
      });

      // Simulated 7-day trend for prototype context
      const trend7d = row.rainfall_24h != null ? Math.round(row.rainfall_24h * 0.3) : undefined;

      return {
        id: row.id,
        name: row.name,
        riskScore,
        riskLevel,
        rainfall24h: row.rainfall_24h != null ? row.rainfall_24h : undefined,
        topFactor,
        trend7d,
      };
    });

    // Zones MUST be sorted by riskScore DESC
    zones.sort((a, b) => b.riskScore - a.riskScore);

    const alerts: CopilotAlertSummary[] = alertsResult.rows.map((r) => ({
      zoneName: r.zone_name,
      level: r.level,
      title: r.title,
    }));

    return {
      ctx: { zones, alerts, generatedAt: new Date().toISOString() },
      zoneMap,
    };
  } catch {
    return {
      ctx: { zones: [], alerts: [], generatedAt: new Date().toISOString() },
      zoneMap: new Map(),
    };
  }
}

const SYSTEM_PROMPT = `You are Talweg Copilot, an assistant for a landslide early-warning prototype for Sikkim, India.
Rules:
- Be concise (max ~120 words). Ground every claim in the LIVE DATA below; cite concrete numbers.
- If asked something unrelated to landslide risk for the tracked zones, say you're scoped to that.
- You are decision support, NOT an emergency warning system. When giving safety guidance, say so and defer to official channels.`;

async function askLLM(question: string, ctx: CopilotContext): Promise<string> {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.COPILOT_TIMEOUT_MS || config.copilotTimeoutMs || 8000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const baseUrl = process.env.LLM_BASE_URL || config.llmBaseUrl || 'https://api.openai.com/v1';
    const apiKey = process.env.LLM_API_KEY || config.llmApiKey;
    const model = process.env.LLM_MODEL || config.llmModel || 'gpt-4o-mini';

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT + contextSummaryForLLM(ctx) },
          { role: 'user', content: question },
        ],
        temperature: 0.3,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('Empty LLM response');
    return answer;
  } finally {
    clearTimeout(timer);
  }
}

copilotRouter.post(
  ['/copilot', '/copilot/ask'],
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid copilot question payload', 'VALIDATION_ERROR', parsed.error.format());
    }

    const question = (parsed.data.question || parsed.data.query || parsed.data.prompt || '').trim();
    const zoneId = parsed.data.zone_id || parsed.data.zoneId;
    const isAskEndpoint = req.path.endsWith('/ask') || Boolean(parsed.data.zone_id);

    // Validation rules:
    // When called as /api/copilot/ask or with zone_id: minimum 5 chars
    // When called as general /api/copilot: minimum 1 char
    const minLength = isAskEndpoint ? 5 : 1;
    if (question.length < minLength || question.length > 500) {
      throw new ApiError(400, `Question must be between ${minLength} and 500 characters`, 'VALIDATION_ERROR');
    }

    const { ctx, zoneMap } = await buildCopilotContext();

    let targetZone = zoneId ? zoneMap.get(zoneId) : undefined;
    if (zoneId && !targetZone) {
      // Check if zoneId exists directly in risk_zones table
      const checkRes = await query<{ id: string; name: string }>(
        'SELECT id, name FROM risk_zones WHERE id = $1',
        [zoneId]
      );
      if (checkRes.rows.length === 0) {
        throw new ApiError(404, `Risk zone '${zoneId}' not found`, 'ZONE_NOT_FOUND');
      }
    }

    // Build evidence if a specific zone was requested
    let evidence: CopilotResponse['evidence'] | undefined;
    if (targetZone) {
      let recentEvents: Array<{ date: string; description: string | null }> = [];
      try {
        const eventsResult = await query<{ date: string; description: string | null }>(`
          SELECT to_char(e.date, 'YYYY-MM-DD') AS date, e.description
          FROM landslide_events e
          JOIN risk_zones z ON ST_Contains(z.geometry, e.geometry)
          WHERE z.id = $1
          ORDER BY e.date DESC
          LIMIT 3
        `, [targetZone.id]);
        recentEvents = eventsResult.rows;
      } catch {
        /* ignore */
      }

      evidence = {
        zone_id: targetZone.id,
        zone_name: targetZone.name,
        risk_score: targetZone.riskScore / 100,
        risk_level: targetZone.riskLevel as any,
        top_factors: targetZone.factors.slice(0, 3).map((f) => ({
          factor: f.factor,
          contribution: f.contribution,
        })),
        recent_events: recentEvents,
        data_source: targetZone.obs_source ?? 'synthetic_seed',
      };
    }

    let answer = '';
    let engine: 'llm' | 'deterministic' = 'deterministic';
    let intent = 'deterministic';

    // 1) Try LLM path if key is set
    const apiKey = process.env.LLM_API_KEY || config.llmApiKey;
    if (apiKey) {
      try {
        answer = await askLLM(question, ctx);
        engine = 'llm';
        intent = 'llm';
      } catch {
        // fall through to deterministic engine
      }
    }

    // 2) Deterministic engine fallback
    if (!answer) {
      let queryText = question;
      if (targetZone && !queryText.toLowerCase().includes(targetZone.name.toLowerCase())) {
        queryText = `${targetZone.name}: ${question}`;
      }
      const result = deterministicAnswer(queryText, ctx);
      answer = result.answer;
      engine = 'deterministic';
      intent = result.intent;

      // When asked about a specific zone, preserve provenance disclosure
      if (evidence && evidence.data_source === 'synthetic_seed' && !answer.includes('synthetic demo data')) {
        answer += ' Note: current data is synthetic demo data (synthetic_seed).';
      } else if (evidence && evidence.data_source === 'chirps_imd' && !answer.includes('real observed data')) {
        answer += ' Note: current precipitation data is real observed data (chirps_imd).';
      }
    }

    const response = {
      answer,
      engine,
      intent,
      source: engine,
      ...(evidence ? { evidence } : {}),
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);

export default copilotRouter;
