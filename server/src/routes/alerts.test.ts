import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { query } from '../db/query';
import { AlertResponse } from '../types/api';

describe('Alerts Router Integration Tests (GET & POST /api/alerts)', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => {
    // Clear any test or existing alerts to test clean state
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

  it('GET /api/alerts returns 200 with an empty array on fresh seeded DB', async () => {
    const res = await fetch(`${baseUrl}/api/alerts`);
    assert.equal(res.status, 200);

    const alerts = (await res.json()) as AlertResponse[];
    assert.ok(Array.isArray(alerts));
    assert.equal(alerts.length, 0);
  });

  it('POST /api/alerts with valid body returns 201 with full AlertResponse shape', async () => {
    const payload = {
      zone_id: 'gangtok',
      severity: 'HIGH',
      risk_score: 0.65,
      message: 'Gangtok Corridor escalated to HIGH risk (65/100). Primary driver: 24h Rainfall.',
      evidence: { rainfall_24h: 150, slope: 35 },
    };

    const res = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 201);
    const alert = (await res.json()) as AlertResponse;

    assert.ok(typeof alert.id === 'number');
    assert.equal(alert.zone_id, 'gangtok');
    assert.equal(alert.zone_name, 'Gangtok Corridor');
    assert.equal(alert.severity, 'HIGH');
    assert.equal(alert.risk_score, 0.65);
    assert.equal(alert.status, 'active');
    assert.equal(alert.message, payload.message);
    assert.deepEqual(alert.evidence, payload.evidence);
    assert.ok(Date.parse(alert.created_at) > 0);
  });

  it('POST /api/alerts with invalid severity returns 400 VALIDATION_ERROR', async () => {
    const payload = {
      zone_id: 'gangtok',
      severity: 'INVALID_SEVERITY',
      risk_score: 0.8,
      message: 'Test invalid alert',
    };

    const res = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 400);
    const err = (await res.json()) as { error: { code: string } };
    assert.equal(err.error.code, 'VALIDATION_ERROR');
  });

  it('POST /api/alerts with unknown zone_id returns 404 ZONE_NOT_FOUND', async () => {
    const payload = {
      zone_id: 'unknown-zone-xyz',
      severity: 'HIGH',
      risk_score: 0.7,
      message: 'Unknown zone alert',
    };

    const res = await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 404);
    const err = (await res.json()) as { error: { code: string } };
    assert.equal(err.error.code, 'ZONE_NOT_FOUND');
  });

  it('GET /api/alerts?zone_id=gangtok filters correctly after a manual POST', async () => {
    await fetch(`${baseUrl}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        zone_id: 'gangtok',
        severity: 'HIGH',
        risk_score: 0.65,
        message: 'Gangtok filter test alert',
      }),
    });

    const res = await fetch(`${baseUrl}/api/alerts?zone_id=gangtok`);
    assert.equal(res.status, 200);

    const alerts = (await res.json()) as AlertResponse[];
    assert.ok(alerts.length >= 1);
    assert.equal(alerts[0].zone_id, 'gangtok');

    const emptyRes = await fetch(`${baseUrl}/api/alerts?zone_id=mangan`);
    assert.equal(emptyRes.status, 200);
    const emptyAlerts = (await emptyRes.json()) as AlertResponse[];
    assert.equal(emptyAlerts.length, 0);
  });
});
