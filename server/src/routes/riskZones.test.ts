import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { RiskZoneResponse } from '../types/api';

describe('GET /api/risk-zones & /api/risk-zones/:id (Integration Tests)', () => {
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

  it('returns all 6 risk zones with calculated risk levels, centroid, and geometry', async () => {
    const res = await fetch(`${baseUrl}/api/risk-zones`);
    assert.equal(res.status, 200);

    const zones = (await res.json()) as RiskZoneResponse[];
    assert.equal(zones.length, 6);

    for (const zone of zones) {
      assert.equal(zone.region_id, 'sikkim');
      assert.equal(zone.geometry.type, 'Polygon');
      assert.ok(typeof zone.centroid.latitude === 'number');
      assert.ok(typeof zone.centroid.longitude === 'number');
      assert.ok(zone.risk_score !== null && zone.risk_score >= 0 && zone.risk_score <= 1);
      assert.ok(
        ['LOW', 'MODERATE', 'HIGH', 'SEVERE'].includes(zone.risk_level as string),
        `Invalid risk level ${zone.risk_level}`
      );
      assert.equal(zone.data_source, 'synthetic_seed');
    }

    // Verify Gangtok golden values
    const gangtok = zones.find((z) => z.id === 'gangtok');
    assert.ok(gangtok);
    assert.equal(gangtok.risk_score, 0.508);
    assert.equal(gangtok.risk_level, 'MODERATE');

    // Verify Mangan golden values
    const mangan = zones.find((z) => z.id === 'mangan');
    assert.ok(mangan);
    assert.equal(mangan.risk_score, 0.56);
    assert.equal(mangan.risk_level, 'MODERATE');
  });

  it('filters risk zones by region_id query parameter', async () => {
    const res = await fetch(`${baseUrl}/api/risk-zones?region_id=sikkim`);
    assert.equal(res.status, 200);
    const zones = (await res.json()) as RiskZoneResponse[];
    assert.equal(zones.length, 6);

    const emptyRes = await fetch(`${baseUrl}/api/risk-zones?region_id=nonexistent`);
    assert.equal(emptyRes.status, 200);
    const emptyZones = (await emptyRes.json()) as RiskZoneResponse[];
    assert.equal(emptyZones.length, 0);
  });

  it('returns a single risk zone by ID via GET /api/risk-zones/:id', async () => {
    const res = await fetch(`${baseUrl}/api/risk-zones/gangtok`);
    assert.equal(res.status, 200);

    const zone = (await res.json()) as RiskZoneResponse;
    assert.equal(zone.id, 'gangtok');
    assert.equal(zone.name, 'Gangtok Corridor');
    assert.equal(zone.risk_score, 0.508);
    assert.equal(zone.risk_level, 'MODERATE');
    assert.equal(zone.data_source, 'synthetic_seed');
  });

  it('returns 404 with ZONE_NOT_FOUND when requesting non-existent zone ID', async () => {
    const res = await fetch(`${baseUrl}/api/risk-zones/unknown-zone`);
    assert.equal(res.status, 404);

    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'ZONE_NOT_FOUND');
    assert.ok(data.error.message.includes('unknown-zone'));
  });

  it('returns 400 with VALIDATION_ERROR on invalid query or ID parameters', async () => {
    const res = await fetch(`${baseUrl}/api/risk-zones?foo=bar`);
    assert.equal(res.status, 400);
    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });
});
