import { query } from '../db/query';
import { config } from '../config';
import { calculateRisk } from './riskEngine';
import { resolveRiskInput, ObservationRow } from './riskInput';
import { ALERT_FACTOR_LABELS } from './alertSync';

export interface CopilotRecentEvent {
  id: string;
  date: string;
  trigger: string | null;
  category: string | null;
  description: string | null;
}

export interface CopilotContext {
  zone: {
    id: string;
    name: string;
    description: string | null;
    base_slope: number | null;
  };
  observation: {
    rainfall_24h: number | null;
    rainfall_3d: number | null;
    rainfall_7d: number | null;
    soil_moisture: number | null;
    slope: number | null;
    source: string;
  } | null;
  eventCount: number;
  recentEvents: CopilotRecentEvent[];
  assessment: {
    risk_score: number;
    risk_level: string;
    contributing_factors: {
      factor: string;
      raw: number;
      normalized: number;
      contribution: number;
    }[];
  } | null;
}

export const FACTOR_LABELS = ALERT_FACTOR_LABELS;

export const SYSTEM_PROMPT =
  'You are SlopeGuard Copilot, a landslide risk assistant. Answer ONLY from the JSON context provided. Never invent data, dates, or measurements. Keep answers under 120 words. If the context lacks information, say so. Always note that current data is synthetic demo data.';

/**
 * Builds grounded context for Copilot from database queries and deterministic risk engine.
 */
export async function buildCopilotContext(zoneId: string): Promise<CopilotContext | null> {
  // 1. Fetch zone
  const zoneResult = await query<{
    id: string;
    name: string;
    description: string | null;
    base_slope: number | null;
  }>('SELECT id, name, description, base_slope FROM risk_zones WHERE id = $1', [zoneId]);

  if (zoneResult.rows.length === 0) {
    return null;
  }

  const zone = zoneResult.rows[0];

  // 2. Fetch latest environmental observation
  const obsResult = await query<{
    rainfall_24h: number | null;
    rainfall_3d: number | null;
    rainfall_7d: number | null;
    soil_moisture: number | null;
    slope: number | null;
    source: string;
  }>(
    `SELECT rainfall_24h, rainfall_3d, rainfall_7d, soil_moisture, slope, source
     FROM environmental_observations
     WHERE zone_id = $1
     ORDER BY timestamp DESC
     LIMIT 1;`,
    [zoneId]
  );

  const observation = obsResult.rows[0] ?? null;

  // 3. Count historical events within polygon
  const densityResult = await query<{ event_count: number }>(
    `SELECT COUNT(*)::int AS event_count
     FROM landslide_events e, risk_zones z
     WHERE z.id = $1 AND ST_Contains(z.geometry, e.geometry);`,
    [zoneId]
  );

  const eventCount = densityResult.rows[0]?.event_count ?? 0;

  // 4. Top 3 recent historical events
  const eventsResult = await query<CopilotRecentEvent>(
    `SELECT e.id, to_char(e.date, 'YYYY-MM-DD') AS date, e.trigger, e.category, e.description
     FROM landslide_events e
     JOIN risk_zones z ON ST_Contains(z.geometry, e.geometry)
     WHERE z.id = $1
     ORDER BY e.date DESC
     LIMIT 3;`,
    [zoneId]
  );

  const recentEvents = eventsResult.rows;

  // 5. Compute deterministic assessment if observation is complete
  let assessment: CopilotContext['assessment'] = null;
  const obsRow: ObservationRow | null = observation;
  const resolved = resolveRiskInput(obsRow, zone.base_slope, eventCount, {});

  if (resolved.ok) {
    const calc = calculateRisk(resolved.input);
    assessment = {
      risk_score: calc.risk_score,
      risk_level: calc.risk_level,
      contributing_factors: calc.contributing_factors.map((f) => ({
        factor: f.factor,
        raw: f.raw,
        normalized: f.normalized,
        contribution: f.contribution,
      })),
    };
  }

  return {
    zone,
    observation,
    eventCount,
    recentEvents,
    assessment,
  };
}

/**
 * Deterministic answer generator using grounded context and keyword routing.
 */
export function deterministicAnswer(ctx: CopilotContext, question: string): string {
  const q = question.toLowerCase();
  const zoneName = ctx.zone.name;
  const source = ctx.observation?.source ?? 'synthetic_seed';
  const provenance = ` Note: current data is synthetic demo data (${source}).`;

  if (!ctx.assessment) {
    return `${zoneName} has no current telemetry recorded. Base slope is ${
      ctx.zone.base_slope ? `${ctx.zone.base_slope}°` : 'unrecorded'
    } with ${ctx.eventCount} historical events recorded in this corridor.${provenance}`;
  }

  const scorePct = Math.round(ctx.assessment.risk_score * 100);
  const riskLevel = ctx.assessment.risk_level;
  const factors = ctx.assessment.contributing_factors;

  // Format top factors summary
  const topFactorsText = factors
    .slice(0, 2)
    .map((f) => {
      const label = FACTOR_LABELS[f.factor] || f.factor;
      const share = ctx.assessment?.risk_score
        ? Math.round((f.contribution / ctx.assessment.risk_score) * 100)
        : 0;
      return `${label} (${share}% share)`;
    })
    .join(' and ');

  const isEventsQuestion = /histor|event|landslide|past|incident/.test(q);
  const isDriversQuestion = /rain|why|risk|driver|factor|high|severe|score/.test(q);

  if (isEventsQuestion) {
    let recentSnippet = `${ctx.eventCount} historical landslide incidents are recorded in this corridor.`;
    if (ctx.recentEvents.length > 0) {
      const topEvt = ctx.recentEvents[0];
      const trigger = topEvt.trigger ? ` triggered by ${topEvt.trigger}` : '';
      recentSnippet += ` Most recent occurred on ${topEvt.date}${trigger}.`;
    }
    return `${zoneName} is currently evaluated at ${riskLevel} risk (${scorePct}/100). ${recentSnippet} Primary active drivers are ${topFactorsText}.${provenance}`;
  }

  if (isDriversQuestion) {
    const r24 = ctx.observation?.rainfall_24h ?? 0;
    const r3d = ctx.observation?.rainfall_3d ?? 0;
    const moist = ctx.observation?.soil_moisture
      ? Math.round(ctx.observation.soil_moisture * 100)
      : 0;

    return `${zoneName} is evaluated at ${riskLevel} risk (${scorePct}/100). The primary risk drivers are ${topFactorsText}. Current telemetry shows 24h rainfall at ${r24} mm, 3-day cumulative at ${r3d} mm, and soil saturation at ${moist}%.${provenance}`;
  }

  // General briefing template
  return `${zoneName} is currently assessed at ${riskLevel} risk with an index of ${scorePct}/100. Key contributing drivers include ${topFactorsText}. There are ${ctx.eventCount} historical events logged for this corridor.${provenance}`;
}

/**
 * LLM answer generator using OpenAI-compatible chat completions endpoint.
 * Throws on any network, timeout, or parsing error so the caller falls back to deterministicAnswer.
 */
export async function llmAnswer(ctx: CopilotContext, question: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.copilotTimeoutMs);

  try {
    const userContent = `Context:\n${JSON.stringify(ctx)}\n\nQuestion: ${question}`;

    const res = await fetch(`${config.llmBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.llmApiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.llmModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM API returned status ${res.status}: ${res.statusText}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('Empty response content received from LLM');
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}
