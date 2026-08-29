import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deterministicAnswer, CopilotContext } from './copilot';

describe('Copilot Deterministic Grounded Logic (copilot.test.ts)', () => {
  const mockContext: CopilotContext = {
    zone: {
      id: 'gangtok',
      name: 'Gangtok Corridor',
      description: 'Capital arterial route',
      base_slope: 35.0,
    },
    observation: {
      rainfall_24h: 85,
      rainfall_3d: 180,
      rainfall_7d: 320,
      soil_moisture: 0.78,
      slope: 35.0,
      source: 'synthetic_seed',
    },
    eventCount: 5,
    recentEvents: [
      {
        id: 'evt-001',
        date: '2023-10-04',
        trigger: 'rain',
        category: 'debris_flow',
        description: 'Monsoon debris flow on NH10',
      },
    ],
    assessment: {
      risk_score: 0.508,
      risk_level: 'MODERATE',
      contributing_factors: [
        { factor: 'rainfall_24h', raw: 85, normalized: 0.425, contribution: 0.128 },
        { factor: 'soil_moisture', raw: 0.78, normalized: 0.78, contribution: 0.117 },
        { factor: 'slope', raw: 35, normalized: 0.778, contribution: 0.117 },
        { factor: 'historical_density', raw: 5, normalized: 0.5, contribution: 0.075 },
        { factor: 'rainfall_3d', raw: 180, normalized: 0.36, contribution: 0.072 },
      ],
    },
  };

  it('deterministicAnswer with full context returns a string containing zone name, level, and synthetic', () => {
    const answer = deterministicAnswer(mockContext, 'Give me a summary of Gangtok');
    assert.ok(answer.includes('Gangtok Corridor'));
    assert.ok(answer.includes('MODERATE'));
    assert.ok(answer.includes('51/100'));
    assert.ok(answer.includes('synthetic demo data (synthetic_seed)'));
  });

  it('events-keyword question routes to the events template (mentions events or incidents)', () => {
    const answer = deterministicAnswer(mockContext, 'What is the landslide history and past events here?');
    assert.ok(answer.includes('5 historical landslide incidents'));
    assert.ok(answer.includes('2023-10-04'));
    assert.ok(answer.includes('synthetic demo data'));
  });

  it('drivers-keyword question routes to drivers template (mentions rainfall or risk drivers)', () => {
    const answer = deterministicAnswer(mockContext, 'Why is this zone at risk and what are the main factors?');
    assert.ok(answer.includes('24h Rainfall'));
    assert.ok(answer.includes('85 mm'));
    assert.ok(answer.includes('Soil Saturation'));
    assert.ok(answer.includes('synthetic demo data'));
  });

  it('null-assessment context produces a graceful answer without crashing', () => {
    const nullAssessmentContext: CopilotContext = {
      ...mockContext,
      observation: null,
      assessment: null,
    };

    const answer = deterministicAnswer(nullAssessmentContext, 'What is the risk here?');
    assert.ok(answer.includes('no current telemetry recorded'));
    assert.ok(answer.includes('35°'));
    assert.ok(answer.includes('5 historical events'));
    assert.ok(answer.includes('synthetic demo data'));
  });

  it('the synthetic-data disclaimer note appears in every template output', () => {
    const generalAns = deterministicAnswer(mockContext, 'Overview');
    const eventsAns = deterministicAnswer(mockContext, 'Tell me past landslides');
    const driversAns = deterministicAnswer(mockContext, 'Why high risk score?');

    assert.ok(generalAns.includes('Note: current data is synthetic demo data'));
    assert.ok(eventsAns.includes('Note: current data is synthetic demo data'));
    assert.ok(driversAns.includes('Note: current data is synthetic demo data'));
  });
});
