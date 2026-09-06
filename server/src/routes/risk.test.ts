import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { query } from '../db/query';
import { RiskPredictionResponse, AlertResponse } from '../types/api';

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
    assert.equal(data.risk_score, 0.457);
    assert.equal(data.risk_level, 'MODERATE');
    assert.equal(data.engine, 'deterministic');
    assert.equal(data.data_source, 'synthetic_seed');
    assert.ok(typeof data.timestamp === 'string');

    // Check inputs used
    assert.equal(data.inputs_used.rainfall_24h, 85);
    assert.equal(data.inputs_used.rainfall_3d, 180);
    assert.equal(data.inputs_used.soil_moisture, 0.78);
    assert.equal(data.inputs_used.slope, 19.6);
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
        rainfall_24h: 170, // Increase 24h rainfall from 85mm to 170mm to reach HIGH with new slope
      }),
    });

    assert.equal(res.status, 200);

    const data = (await res.json()) as RiskPredictionResponse;
    assert.equal(data.zone_id, 'gangtok');
    assert.equal(data.risk_score, 0.584);
    assert.equal(data.risk_level, 'HIGH');
    assert.equal(data.inputs_used.rainfall_24h, 170);
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

describe('Alert Sync via risk computation', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    await query('DELETE FROM alerts');

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

  it('predicting gangtok baseline (MODERATE) creates NO alert', async () => {
    const predictRes = await fetch(`${baseUrl}/api/risk/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok' }),
    });
    assert.equal(predictRes.status, 200);

    const alertsRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=active`);
    assert.equal(alertsRes.status, 200);
    const alerts = (await alertsRes.json()) as AlertResponse[];
    assert.equal(alerts.length, 0);
  });

  it('simulating gangtok with rainfall_24h: 170 (HIGH) creates exactly ONE active HIGH alert', async () => {
    const simRes = await fetch(`${baseUrl}/api/risk/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok', rainfall_24h: 170 }),
    });
    assert.equal(simRes.status, 200);

    const alertsRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=active`);
    assert.equal(alertsRes.status, 200);
    const alerts = (await alertsRes.json()) as AlertResponse[];
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].zone_id, 'gangtok');
    assert.equal(alerts[0].severity, 'HIGH');
    assert.match(alerts[0].message, /Gangtok Corridor/);
    assert.match(alerts[0].message, /escalated to HIGH/);
  });

  it('simulating again at same HIGH level updates rather than duplicates', async () => {
    const simRes = await fetch(`${baseUrl}/api/risk/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zone_id: 'gangtok', rainfall_24h: 175 }),
    });
    assert.equal(simRes.status, 200);

    const alertsRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=active`);
    assert.equal(alertsRes.status, 200);
    const alerts = (await alertsRes.json()) as AlertResponse[];
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].severity, 'HIGH');
  });

  it('simulating gangtok all-sliders-max (SEVERE) supersedes with single SEVERE alert', async () => {
    const simRes = await fetch(`${baseUrl}/api/risk/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        rainfall_24h: 200,
        rainfall_3d: 500,
        soil_moisture: 1.0,
        slope: 45,
      }),
    });
    assert.equal(simRes.status, 200);

    const alertsRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=active`);
    assert.equal(alertsRes.status, 200);
    const alerts = (await alertsRes.json()) as AlertResponse[];
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].severity, 'SEVERE');
    assert.match(alerts[0].message, /escalated to SEVERE/);

    // Old alerts are marked resolved
    const allRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=all`);
    const allAlerts = (await allRes.json()) as AlertResponse[];
    const resolved = allAlerts.filter((a) => a.status === 'resolved');
    assert.ok(resolved.length >= 1);
  });

  it('simulating back below HIGH resolves the active alert', async () => {
    const simRes = await fetch(`${baseUrl}/api/risk/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        rainfall_24h: 20,
        rainfall_3d: 50,
        soil_moisture: 0.2,
      }),
    });
    assert.equal(simRes.status, 200);

    const alertsRes = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok&status=active`);
    assert.equal(alertsRes.status, 200);
    const alerts = (await alertsRes.json()) as AlertResponse[];
    assert.equal(alerts.length, 0);
  });
});
