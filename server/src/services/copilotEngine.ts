/**
 * Copilot Engine — deterministic, context-grounded answer generation.
 * Zero external dependencies. This is the fallback engine used when no
 * LLM_API_KEY is configured (or when the LLM call fails/times out).
 *
 * Design guarantee: the answer DEPENDS ON THE QUESTION.
 * - Intent is classified by keyword scoring (multiple intents)
 * - Zone names mentioned in the question are detected and change the answer
 * - Answers are grounded in live zone/alert data passed via CopilotContext
 */

export interface CopilotZoneSummary {
  id: string;
  name: string;
  riskScore: number; // 0–100
  riskLevel: string; // 'Low' | 'Moderate' | 'High' | ...
  rainfall24h?: number; // mm
  topFactor?: string;
  trend7d?: number; // % change over 7 days (simulated — disclosed as such)
}

export interface CopilotAlertSummary {
  zoneName: string;
  level: string;
  title: string;
}

export interface CopilotContext {
  zones: CopilotZoneSummary[]; // MUST be sorted by riskScore DESC
  alerts: CopilotAlertSummary[];
  generatedAt: string;
}

export interface CopilotResult {
  answer: string;
  intent: string;
  matchedZone?: string;
}

// ─── Intent keyword tables (array order = tie-break priority) ───

interface IntentDef {
  name: string;
  keywords: string[];
}

const INTENT_DEFS: IntentDef[] = [
  {
    name: 'about',
    keywords: ['who are you', 'what are you', 'what can you', 'help me', 'capabilities',
      'what is talweg', 'what is slopeguard', 'how do you work'],
  },
  {
    name: 'highest_risk',
    keywords: ['highest risk', 'most dangerous', 'riskiest', 'most risky', 'most at risk',
      'worst zone', 'top zone', 'top risk', 'most severe', 'which zone should'],
  },
  {
    name: 'alerts',
    keywords: ['alert', 'alerts', 'warning', 'warnings', 'alarm', 'active alert', 'emergency'],
  },
  {
    name: 'guidance',
    keywords: ['what should', 'should i', 'should we', 'do i need', 'evacuate', 'evacuation',
      'prepare', 'precaution', 'advisory', 'recommend', 'response plan', 'safe to',
      'is it safe', 'travel', 'road'],
  },
  {
    name: 'compare',
    keywords: ['compare', 'versus', 'difference between', 'which is worse',
      'which is better', 'which is safer'],
  },
  {
    name: 'trend',
    keywords: ['trend', 'rising', 'increasing', 'spiking', 'decreasing', 'falling',
      'outlook', 'forecast', '7-day', '7 day', 'next week', 'coming days'],
  },
  {
    name: 'rainfall',
    keywords: ['rain', 'rainfall', 'precipitation', 'downpour', 'monsoon', 'mm', 'how wet'],
  },
  {
    name: 'factors',
    keywords: ['factor', 'factors', 'why', 'explain', 'breakdown', 'contribution',
      'contributing', 'driver', 'drivers', 'cause', 'causes', 'soil', 'saturation',
      'slope', 'geology', 'land use', 'vegetation'],
  },
  {
    name: 'history',
    keywords: ['history', 'historical', 'in the past', 'past landslide', 'previous',
      'occurred', 'inventory', 'gls', 'event', 'events', 'incident', 'incidents'],
  },
  {
    name: 'zone_risk',
    keywords: ['risk', 'status', 'condition', 'situation', 'current', 'about',
      'score', 'severity'],
  },
];

// ─── Helpers ───

function keywordHit(qLower: string, kw: string): boolean {
  if (kw.includes(' ')) return qLower.includes(kw);
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(qLower);
}

function trendText(z: CopilotZoneSummary): string {
  if (typeof z.trend7d !== 'number') return '';
  const sign = z.trend7d >= 0 ? '+' : '';
  return ` 7-day risk trend (simulated trajectory): ${sign}${z.trend7d}%.`;
}

// ─── Per-intent answer builders (all grounded in ctx) ───

function answerHighestRisk(ctx: CopilotContext): string {
  const top = ctx.zones[0];
  const second = ctx.zones[1];
  let a = `Based on current live data, ${top.name} is the highest-risk zone at ${top.riskScore}/100 (${top.riskLevel}).`;
  if (top.topFactor) {
    a += ` Its dominant risk driver right now is ${top.topFactor}`;
    if (typeof top.rainfall24h === 'number') a += ` (${top.rainfall24h} mm of rain in the last 24h)`;
    a += '.';
  }
  if (second) a += ` ${second.name} follows at ${second.riskScore}/100 (${second.riskLevel}).`;
  a += ' Select the zone on the map for the full factor breakdown.';
  return a;
}

function answerZoneRisk(zone: CopilotZoneSummary): string {
  let a = `${zone.name} is currently at ${zone.riskScore}/100 (${zone.riskLevel}).`;
  if (zone.topFactor) a += ` The largest contributing factor is ${zone.topFactor}.`;
  if (typeof zone.rainfall24h === 'number') a += ` Recent rainfall: ${zone.rainfall24h} mm in the last 24h.`;
  a += trendText(zone);
  return a;
}

function answerOverallSummary(ctx: CopilotContext): string {
  const top3 = ctx.zones.slice(0, 3);
  const list = top3.map((z) => `${z.name} (${z.riskScore}/100, ${z.riskLevel})`).join('; ');
  return `I'm tracking ${ctx.zones.length} zones. Current top three by severity: ${list}. Ask about a specific zone by name for detailed factors, rainfall, and trend.`;
}

function answerRainfall(ctx: CopilotContext): string {
  const withRain = ctx.zones.filter((z) => typeof z.rainfall24h === 'number');
  if (withRain.length === 0) {
    return `I don't have live rainfall figures loaded right now. Rainfall is one of the weighted inputs in the risk engine — ask me about overall zone risk instead.`;
  }
  const sorted = [...withRain].sort((a, b) => (b.rainfall24h ?? 0) - (a.rainfall24h ?? 0));
  const top = sorted[0];
  let a = `Highest 24h rainfall is in ${top.name} at ${top.rainfall24h} mm (risk: ${top.riskScore}/100, ${top.riskLevel}).`;
  if (sorted[1] && typeof sorted[1].rainfall24h === 'number') {
    a += ` ${sorted[1].name} follows at ${sorted[1].rainfall24h} mm.`;
  }
  a += ' Sustained rainfall raises soil saturation, which is a major risk driver.';
  return a;
}

function answerAlerts(ctx: CopilotContext): string {
  if (ctx.alerts.length === 0) {
    const top = ctx.zones[0];
    return `No active alerts right now. The highest watch-level zone is ${top.name} at ${top.riskScore}/100 (${top.riskLevel}) — worth monitoring if rainfall continues. The alert banner appears at the top of the dashboard when thresholds are crossed.`;
  }
  const list = ctx.alerts.map((al) => `${al.title} — ${al.zoneName} (${al.level})`).join('; ');
  return `There ${ctx.alerts.length === 1 ? 'is 1 active alert' : `are ${ctx.alerts.length} active alerts`}: ${list}. Check the alert banner and the Notification Chain panel for the escalation status.`;
}

function answerTrend(ctx: CopilotContext): string {
  const top = ctx.zones[0];
  let a = `For ${top.name} (currently ${top.riskScore}/100):`;
  a += trendText(top) || ' I don\'t have a 7-day trajectory loaded for this zone right now.';
  if (top.topFactor) a += ` The trend is driven primarily by ${top.topFactor}.`;
  a += ' Note: the 7-day trajectory is a simulated outlook for this prototype, as disclosed in the Risk Trend panel.';
  return a;
}

function answerFactors(zone: CopilotZoneSummary): string {
  let a = `Main risk drivers for ${zone.name} (currently ${zone.riskScore}/100, ${zone.riskLevel}):`;
  if (zone.topFactor) a += ` the leading contributor is ${zone.topFactor};`;
  if (typeof zone.rainfall24h === 'number') a += ` 24h rainfall is at ${zone.rainfall24h} mm;`;
  a += ' slope, soil saturation, and historical susceptibility complete the weighted model. Open the Factor Breakdown section in this panel for the full percentage contributions.';
  return a;
}

function answerCompare(zA: CopilotZoneSummary, zB: CopilotZoneSummary): string {
  const worse = zA.riskScore >= zB.riskScore ? zA : zB;
  const safer = zA.riskScore >= zB.riskScore ? zB : zA;
  let a = `${zA.name}: ${zA.riskScore}/100 (${zA.riskLevel}) vs ${zB.name}: ${zB.riskScore}/100 (${zB.riskLevel}).`;
  a += ` ${worse.name} currently carries the higher risk, by ${worse.riskScore - safer.riskScore} points.`;
  if (worse.topFactor) a += ` Its leading driver is ${worse.topFactor}.`;
  return a;
}

function answerGuidance(ctx: CopilotContext): string {
  const highAlerts = ctx.alerts.filter((al) => /high|very/i.test(al.level));
  if (highAlerts.length > 0) {
    const names = highAlerts.map((al) => al.zoneName).join(', ');
    return `There are active high-level alerts for ${names}. Follow the alert banner and the Response Guidance panel for zone-specific actions. Note: this is a decision-support prototype, not an operational emergency warning system — always defer to official channels.`;
  }
  const top = ctx.zones[0];
  return `No active alerts. For ${top.name} (highest current risk at ${top.riskScore}/100): monitor rainfall updates, avoid non-essential travel through the corridor during intense rain, and watch for alert escalation. Note: this is a decision-support prototype, not an operational emergency warning system — always defer to official channels.`;
}

function answerHistory(ctx: CopilotContext): string {
  const top = ctx.zones[0];
  return `This prototype's historical layer shows past landslide points from the NASA GLC inventory on the map (see the legend). For current conditions, ${top.name} is the highest-scoring zone at ${top.riskScore}/100 — ask me about its factors or the 7-day outlook for detail.`;
}

function answerAbout(): string {
  return `I'm the Talweg Copilot — a grounded assistant over this prototype's live risk data. I can answer: which zone is most at risk, a specific zone's status and factors, current rainfall, active alerts, the 7-day outlook, and zone comparisons. Try: "Which zone has the highest risk right now?"`;
}

// Rotating fallback templates so even unmatched questions don't repeat verbatim
const FALLBACK_EXAMPLES = [
  '"Which zone has the highest risk right now?"',
  '"Are there any active alerts?"',
  '"Explain the risk factors for Gangtok Corridor"',
  '"What is the 7-day outlook?"',
];

function answerFallback(question: string): string {
  const seed = question.length % FALLBACK_EXAMPLES.length;
  const ex1 = FALLBACK_EXAMPLES[seed];
  const ex2 = FALLBACK_EXAMPLES[(seed + 1) % FALLBACK_EXAMPLES.length];
  return `I'm not sure how to answer that. I'm scoped to landslide risk for the tracked Sikkim zones. Try questions like ${ex1} or ${ex2}.`;
}

// ─── Main entry point ───

export function deterministicAnswer(question: string, ctx: CopilotContext): CopilotResult {
  const q = (question ?? '').toLowerCase().trim();

  // 1) Detect zone mentions (strongest signal — changes the answer per zone)
  const mentioned = ctx.zones.filter((z) => {
    if (!z.name) return false;
    const nameLower = z.name.toLowerCase();
    if (q.includes(nameLower)) return true;
    const firstWord = nameLower.split(/\s+/)[0];
    return firstWord.length >= 3 && keywordHit(q, firstWord);
  });
  const matchedZone = mentioned[0]?.name;

  // 2) Degraded mode: DB context unavailable — never crash, be honest
  if (ctx.zones.length === 0) {
    return {
      answer:
        'I could not load live risk data right now. The deterministic engine needs the database to answer zone questions — check the backend connection and try again.',
      intent: 'degraded',
    };
  }

  // 3) Score intents
  const scores = new Map<string, number>();
  for (const def of INTENT_DEFS) {
    let s = 0;
    for (const kw of def.keywords) if (keywordHit(q, kw)) s += 3;
    if (s > 0) scores.set(def.name, s);
  }
  if (mentioned.length >= 1) {
    scores.set('zone_risk', (scores.get('zone_risk') ?? 0) + 6);
    if (mentioned.length >= 2) {
      scores.set('compare', (scores.get('compare') ?? 0) + 6);
    }
  }

  // 4) Pick winner (array order breaks ties)
  let best = 'fallback';
  let bestScore = 0;
  for (const def of INTENT_DEFS) {
    const s = scores.get(def.name) ?? 0;
    if (s > bestScore) {
      bestScore = s;
      best = def.name;
    }
  }

  // 5) Build the grounded answer
  switch (best) {
    case 'about':
      return { answer: answerAbout(), intent: best };
    case 'highest_risk':
      return { answer: answerHighestRisk(ctx), intent: best };
    case 'alerts':
      return { answer: answerAlerts(ctx), intent: best };
    case 'guidance':
      return { answer: answerGuidance(ctx), intent: best };
    case 'compare':
      if (mentioned.length >= 2) {
        return { answer: answerCompare(mentioned[0], mentioned[1]), intent: best, matchedZone };
      }
      return {
        answer: `Name two zones to compare (e.g., "Compare Gangtok Corridor and Mangan Valley"). Zones I'm tracking: ${ctx.zones
          .slice(0, 6)
          .map((z) => z.name)
          .join(', ')}.`,
        intent: best,
      };
    case 'trend':
      return { answer: answerTrend(ctx), intent: best };
    case 'rainfall':
      return { answer: answerRainfall(ctx), intent: best };
    case 'factors': {
      const zone = mentioned[0] ?? ctx.zones[0];
      return { answer: answerFactors(zone), intent: best, matchedZone: zone.name };
    }
    case 'history':
      return { answer: answerHistory(ctx), intent: best };
    case 'zone_risk':
      if (mentioned.length === 1) {
        return { answer: answerZoneRisk(mentioned[0]), intent: best, matchedZone };
      }
      return { answer: answerOverallSummary(ctx), intent: best };
    default:
      return { answer: answerFallback(question), intent: 'fallback' };
  }
}

// ─── LLM support: compact context summary for the system prompt ───

export function contextSummaryForLLM(ctx: CopilotContext): string {
  const zoneLines = ctx.zones
    .slice(0, 10)
    .map(
      (z) =>
        `- ${z.name}: ${z.riskScore}/100 (${z.riskLevel})${
          typeof z.rainfall24h === 'number' ? `, 24h rain ${z.rainfall24h}mm` : ''
        }${z.topFactor ? `, top factor: ${z.topFactor}` : ''}`
    )
    .join('\n');
  const alertLines = ctx.alerts.map((a) => `- ${a.title} (${a.zoneName}, ${a.level})`).join('\n');
  return `\nLIVE DATA (ground every claim in these numbers):\nZones:\n${zoneLines}\nActive alerts:\n${
    alertLines || '- none'
  }`;
}
