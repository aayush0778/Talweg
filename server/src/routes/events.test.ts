import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { createApp } from '../app';
import { LandslideEventResponse } from '../types/api';

describe('GET /api/events (Integration Test)', () => {
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

  it('returns seeded historical events with valid date format and geometry', async () => {
    const res = await fetch(`${baseUrl}/api/events`);
    assert.equal(res.status, 200);

    const events = (await res.json()) as LandslideEventResponse[];
    assert.ok(events.length >= 15);

    for (const evt of events) {
      assert.ok(evt.id.startsWith('evt-') || evt.id.startsWith('glc-'));
      assert.match(evt.date, /^\d{4}-\d{2}-\d{2}$/, `Date ${evt.date} must be YYYY-MM-DD`);
      assert.equal(evt.geometry.type, 'Point');
      assert.ok(evt.source === 'synthetic_seed' || evt.source.includes('NASA') || evt.source === 'nasa_glc');
    }
  });

  it('filters events by zone_id (Gangtok corridor)', async () => {
    const res = await fetch(`${baseUrl}/api/events?zone_id=gangtok`);
    assert.equal(res.status, 200);

    const events = (await res.json()) as LandslideEventResponse[];
    assert.ok(events.length >= 5);
    const eventIds = events.map((e) => e.id);
    for (const id of ['evt-001', 'evt-002', 'evt-003', 'evt-004', 'evt-005']) {
      assert.ok(eventIds.includes(id));
    }
  });

  it('respects the limit query parameter', async () => {
    const res = await fetch(`${baseUrl}/api/events?limit=3`);
    assert.equal(res.status, 200);

    const events = (await res.json()) as LandslideEventResponse[];
    assert.equal(events.length, 3);
  });

  it('returns 404 ZONE_NOT_FOUND when filtering by non-existent zone_id', async () => {
    const res = await fetch(`${baseUrl}/api/events?zone_id=nonexistent-zone`);
    assert.equal(res.status, 404);

    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'ZONE_NOT_FOUND');
  });

  it('returns 400 VALIDATION_ERROR for invalid limit query parameter', async () => {
    const res = await fetch(`${baseUrl}/api/events?limit=invalid`);
    assert.equal(res.status, 400);

    const data = (await res.json()) as { error: { code: string; message: string } };
    assert.equal(data.error.code, 'VALIDATION_ERROR');
  });
});
