import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { EnvironmentResponse } from '../types/api';

describe('GET /api/environment/:zoneId (Integration Test)', () => {
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

  it('returns current environmental observation for a valid zone (Gangtok)', async () => {
    const res = await fetch(`${baseUrl}/api/environment/gangtok`);
    assert.equal(res.status, 200);

    const env = (await res.json()) as EnvironmentResponse;
    assert.equal(env.zone_id, 'gangtok');
    assert.equal(env.zone_name, 'Gangtok Corridor');
    assert.equal(env.rainfall_24h, 85);
    assert.equal(env.rainfall_3d, 180);
    assert.equal(env.rainfall_7d, 320);
    assert.equal(env.soil_moisture, 0.78);
    assert.equal(env.slope, 19.6);
    assert.equal(env.source, 'synthetic_seed');
    assert.ok(typeof env.timestamp === 'string');
  });

  it('returns 404 with ZONE_NOT_FOUND when zone does not exist', async () => {
    const res = await fetch(`${baseUrl}/api/environment/nonexistent-zone`);
    assert.equal(res.status, 404);

    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'ZONE_NOT_FOUND');
  });

  it('returns 400 with VALIDATION_ERROR on invalid zoneId format', async () => {
    const res = await fetch(`${baseUrl}/api/environment/bad%20zone!`);
    assert.equal(res.status, 400);

    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });
});
