import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { RiskPredictionResponse } from '../types/api';

describe('POST /api/risk/predict & /api/risk/simulate (Integration Tests)', () => {
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

  it('predicts risk for a zone using stored environmental observations and spatial density', async () => {
    const res = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok' }),
    });

    assert.equal(res.status, 200);

    const data = (await res.json()) as RiskPredictionResponse;
    assert.equal(data.zone_id, 'gangtok');
    assert.equal(data.zone_name, 'Gangtok Corridor');
    assert.equal(data.risk_score, 0.508);
    assert.equal(data.risk_level, 'MODERATE');
    assert.equal(data.engine, 'deterministic');
    assert.equal(data.data_source, 'synthetic_seed');
    assert.ok(typeof data.timestamp === 'string');

    // Check inputs used
    assert.equal(data.inputs_used.rainfall_24h, 85);
    assert.equal(data.inputs_used.rainfall_3d, 180);
    assert.equal(data.inputs_used.soil_moisture, 0.78);
    assert.equal(data.inputs_used.slope, 35);
    assert.equal(data.inputs_used.historical_density, 5);

    // Factors sorted by contribution descending
    assert.equal(data.contributing_factors.length, 5);
    assert.equal(data.contributing_factors[0].factor, 'rainfall_24h');
  });

  it('simulates what-if scenario with rainfall override and flips risk level to HIGH', async () => {
    const res = await fetch(`${baseUrl}/api/risk/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        rainfall_24h: 150, // Increase 24h rainfall from 85mm to 150mm
      }),
    });

    assert.equal(res.status, 200);

    const data = (await res.json()) as RiskPredictionResponse;
    assert.equal(data.zone_id, 'gangtok');
    assert.equal(data.risk_score, 0.606);
    assert.equal(data.risk_level, 'HIGH');
    assert.equal(data.inputs_used.rainfall_24h, 150);
    assert.equal(data.inputs_used.rainfall_3d, 180); // Unmodified
  });

  it('returns 404 ZONE_NOT_FOUND when predicting for an unknown zone', async () => {
    const res = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'nonexistent-zone' }),
    });

    assert.equal(res.status, 404);
    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'ZONE_NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR on negative rainfall value', async () => {
    const res = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok', rainfall_24h: -10 }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR on unknown body keys (.strict schema)', async () => {
    const res = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok', invalidKey: 123 }),
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });

  it('returns 400 VALIDATION_ERROR on malformed JSON payload without crashing', async () => {
    const res = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ malformed json: true, ',
    });

    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });
});
