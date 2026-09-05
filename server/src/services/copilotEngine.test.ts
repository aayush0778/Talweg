/**
 * Regression tests for the "copilot always returns the same response" bug.
 * The core assertion is literally the bug report:
 *   different questions → different answers.
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  CopilotContext,
  deterministicAnswer,
} from './copilotEngine';

const ctx: CopilotContext = {
  zones: [
    { id: '1', name: 'Gangtok Corridor', riskScore: 51, riskLevel: 'Moderate',
      rainfall24h: 85, topFactor: '24h Rainfall', trend7d: 26 },
    { id: '2', name: 'Namchi Slope', riskScore: 72, riskLevel: 'High',
      rainfall24h: 112, topFactor: 'Soil Saturation', trend7d: 12 },
    { id: '3', name: 'Mangan Valley', riskScore: 33, riskLevel: 'Low',
      rainfall24h: 21, topFactor: 'Slope', trend7d: -4 },
  ],
  alerts: [
    { zoneName: 'Namchi Slope', level: 'High', title: 'Rainfall threshold exceeded' },
  ],
  generatedAt: new Date().toISOString(),
};

test('different questions produce different answers (the reported bug)', () => {
  const a = deterministicAnswer('Which zone has the highest risk right now?', ctx);
  const b = deterministicAnswer('Are there any active alerts?', ctx);
  const c = deterministicAnswer('What is the 7-day outlook?', ctx);
  assert.notEqual(a.answer, b.answer);
  assert.notEqual(b.answer, c.answer);
  assert.notEqual(a.answer, c.answer);
});

test('mentioning different zone names changes the answer', () => {
  const a = deterministicAnswer('What is the risk in Gangtok Corridor?', ctx);
  const b = deterministicAnswer('What is the risk in Mangan Valley?', ctx);
  assert.notEqual(a.answer, b.answer);
  assert.match(a.answer, /Gangtok Corridor/);
  assert.match(b.answer, /Mangan Valley/);
});

test('highest-risk answer names the actual top zone from context', () => {
  const r = deterministicAnswer('Which zone is the most dangerous?', ctx);
  assert.match(r.answer, /Namchi Slope/);
  assert.match(r.answer, /72\/100/);
});

test('alerts answer reflects live active alerts', () => {
  const r = deterministicAnswer('Any warnings or alerts active?', ctx);
  assert.match(r.answer, /Namchi Slope/);
  assert.match(r.answer, /Rainfall threshold exceeded/);
});

test('compare intent with two named zones compares their scores', () => {
  const r = deterministicAnswer('Compare Gangtok Corridor and Mangan Valley', ctx);
  assert.match(r.answer, /51\/100/);
  assert.match(r.answer, /33\/100/);
});

test('rainfall intent reports the wettest zone', () => {
  const r = deterministicAnswer('How much rain has fallen?', ctx);
  assert.match(r.answer, /Namchi Slope/);
  assert.match(r.answer, /112 mm/);
});

test('guidance includes the prototype disclaimer', () => {
  const r = deterministicAnswer('What should we do right now?', ctx);
  assert.match(r.answer, /decision-support prototype/i);
});

test('fallback never crashes and points to valid example questions', () => {
  const r = deterministicAnswer('xyzzy quux blorb completely unrelated', ctx);
  assert.ok(r.answer.length > 20);
  assert.match(r.answer, /Try questions like/i);
  assert.equal(r.intent, 'fallback');
});

test('degraded context (DB down) yields an honest message, not a crash', () => {
  const r = deterministicAnswer('Which zone is risky?', {
    zones: [], alerts: [], generatedAt: new Date().toISOString(),
  });
  assert.equal(r.intent, 'degraded');
  assert.match(r.answer, /could not load/i);
});

test('suggested chip: would TALWEG have flagged this event returns grounded replay answer', () => {
  const r = deterministicAnswer('Would TALWEG have flagged this event?', ctx);
  assert.equal(r.intent, 'flagged_replay');
  assert.match(r.answer, /NASA GLC #15243/);
  assert.match(r.answer, /HIGH/);
});

test('suggested chip: show me this terrain in 3D returns 3D guidance', () => {
  const r = deterministicAnswer('Show me this terrain in 3D.', ctx);
  assert.equal(r.intent, 'terrain_3d');
  assert.match(r.answer, /3D Terrain/);
  assert.match(r.answer, /55°/);
});

