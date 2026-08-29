import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { RegionResponse } from '../types/api';

describe('GET /api/regions (Integration Test)', () => {
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

  it('returns all monitored regions including Sikkim with valid GeoJSON geometry and bounds', async () => {
    const res = await fetch(`${baseUrl}/api/regions`);
    assert.equal(res.status, 200);

    const regions = (await res.json()) as RegionResponse[];
    assert.ok(Array.isArray(regions));
    assert.equal(regions.length, 1);

    const sikkim = regions[0];
    assert.equal(sikkim.id, 'sikkim');
    assert.equal(sikkim.name, 'Sikkim');
    assert.equal(sikkim.state, 'Sikkim');
    assert.equal(sikkim.geometry.type, 'Polygon');
    assert.ok(Array.isArray(sikkim.geometry.coordinates));

    // Verify bounds [minX, minY, maxX, maxY]
    assert.equal(sikkim.bounds.length, 4);
    const [minX, minY, maxX, maxY] = sikkim.bounds;
    assert.ok(minX >= 88.0 && minX <= 88.1);
    assert.ok(minY >= 27.0 && minY <= 27.1);
    assert.ok(maxX >= 88.9 && maxX <= 89.0);
    assert.ok(maxY >= 28.1 && maxY <= 28.2);
  });
});
