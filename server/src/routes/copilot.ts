import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { ApiError } from '../middleware/apiError';
import { config } from '../config';
import { copilotBodySchema } from '../validation/schemas';
import { buildCopilotContext, deterministicAnswer, llmAnswer } from '../services/copilot';
import { CopilotResponse } from '../types/api';

export const copilotRouter = Router();

copilotRouter.post(
  '/copilot/ask',
  asyncHandler(async (req, res) => {
    const parsed = copilotBodySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, 'Invalid copilot question payload', 'VALIDATION_ERROR', parsed.error.format());
    }

    const { zone_id, question } = parsed.data;
    const ctx = await buildCopilotContext(zone_id);

    if (!ctx) {
      throw new ApiError(404, `Risk zone '${zone_id}' not found`, 'ZONE_NOT_FOUND');
    }

    const evidence: CopilotResponse['evidence'] = {
      zone_id: ctx.zone.id,
      zone_name: ctx.zone.name,
      risk_score: ctx.assessment?.risk_score ?? null,
      risk_level: ctx.assessment?.risk_level ?? null,
      top_factors:
        ctx.assessment?.contributing_factors.slice(0, 3).map((f) => ({
          factor: f.factor,
          contribution: f.contribution,
        })) ?? [],
      recent_events: ctx.recentEvents.map((e) => ({
        date: e.date,
        description: e.description,
      })),
      data_source: ctx.observation?.source ?? 'synthetic_seed',
    };

    let answer: string;
    let source: 'llm' | 'deterministic';

    if (config.llmApiKey) {
      try {
        answer = await llmAnswer(ctx, question);
        source = 'llm';
      } catch {
        answer = deterministicAnswer(ctx, question);
        source = 'deterministic';
      }
    } else {
      answer = deterministicAnswer(ctx, question);
      source = 'deterministic';
    }

    const response: CopilotResponse = {
      answer,
      evidence,
      source,
      timestamp: new Date().toISOString(),
    };

    res.json(response);
  })
);
