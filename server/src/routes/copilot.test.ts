import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { CopilotResponse } from '../types/api';

describe('POST /api/copilot/ask (Integration Tests)', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    const app = createApp();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('valid question for gangtok returns 200 with deterministic source and grounded evidence', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        question: 'Why is Gangtok at moderate risk?',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as CopilotResponse;

    assert.equal(data.source, 'deterministic');
    assert.ok(typeof data.answer === 'string');
    assert.ok(data.answer.includes('Gangtok'));
    assert.ok(data.answer.includes('synthetic demo data'));

    assert.equal(data.evidence.zone_id, 'gangtok');
    assert.equal(data.evidence.zone_name, 'Gangtok Corridor');
    assert.equal(data.evidence.data_source, 'synthetic_seed');
    assert.equal(data.evidence.risk_level, 'MODERATE');
    assert.ok(Array.isArray(data.evidence.top_factors));
    assert.ok(data.evidence.top_factors.length > 0);
  });

  it('question mentioning history/events produces an answer highlighting historical events', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        question: 'What is the past landslide history and recorded events in this corridor?',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as CopilotResponse;
    assert.ok(data.answer.includes('historical') || data.answer.includes('incidents'));
  });

  it('question under 5 characters returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        question: 'Why',
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });

  it('question over 500 characters returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        question: 'A'.repeat(501),
      }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });

  it('unknown zone_id returns 404 ZONE_NOT_FOUND', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'unknown-zone-xyz',
        question: 'What is the risk here?',
      }),
    });

    assert.equal(res.status, 404);
    const data = (await res.json()) as { error: { code: string } };
    assert.equal(data.error.code, 'ZONE_NOT_FOUND');
  });

  it('source field is exactly "deterministic" when no LLM key is configured', async () => {
    const res = await fetch(`${baseUrl}/api/copilot/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        question: 'Explain the current risk factors.',
      }),
    });

    assert.equal(res.status, 200);
    const data = (await res.json()) as CopilotResponse;
    assert.equal(data.source, 'deterministic');
  });
});
