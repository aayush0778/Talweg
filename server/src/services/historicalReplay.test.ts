import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getReplayStatus,
  listHistoricalReplays,
  getHistoricalReplayById,
  replayHistoricalEvent,
  buildValidationSummary,
} from './historicalReplay';

describe('Historical Replay Service (historicalReplay.ts)', () => {
  describe('getReplayStatus()', () => {
    it('returns real_replay status with verified dataset caveat', () => {
      const status = getReplayStatus('nasa_glc', 'real_replay');
      assert.equal(status.status, 'real_replay');
      assert.match(status.caveat, /verified historical datasets/i);
    });

    it('returns synthetic_demo status for synthetic seed data', () => {
      const status = getReplayStatus('synthetic_seed', 'synthetic_demo');
      assert.equal(status.status, 'synthetic_demo');
      assert.match(status.caveat, /not recorded historical weather/i);
    });

    it('returns methodology_only for unknown/partial data', () => {
      const status = getReplayStatus('partial_source', 'unverified');
      assert.equal(status.status, 'methodology_only');
      assert.match(status.caveat, /insufficient verified/i);
    });
  });

  describe('listHistoricalReplays() in-memory fallback', () => {
    it('returns replay records for all 15 events even when DB is offline', async () => {
      const replays = await listHistoricalReplays();
      assert.ok(Array.isArray(replays));
      assert.equal(replays.length, 15);
      assert.ok(replays[0].id.startsWith('replay-evt-'));
      assert.equal(replays[0].source, 'synthetic_seed');
      assert.equal(replays[0].data_quality, 'synthetic_demo');
    });
  });

  describe('getHistoricalReplayById() in-memory fallback', () => {
    it('finds existing replay by replay-evt-001 ID', async () => {
      const replay = await getHistoricalReplayById('replay-evt-001');
      assert.ok(replay);
      assert.equal(replay?.id, 'replay-evt-001');
      assert.equal(replay?.event_id, 'evt-001');
      assert.equal(replay?.zone_id, 'gangtok');
    });

    it('finds existing replay by raw evt-001 ID', async () => {
      const replay = await getHistoricalReplayById('evt-001');
      assert.ok(replay);
      assert.equal(replay?.event_id, 'evt-001');
    });

    it('returns null for non-existent event', async () => {
      const replay = await getHistoricalReplayById('replay-nonexistent-999');
      assert.equal(replay, null);
    });
  });

  describe('replayHistoricalEvent()', () => {
    it('replays evt-001 with full assessment, provenance, and flagged status', async () => {
      const result = await replayHistoricalEvent('replay-evt-001');
      assert.ok(result);
      assert.equal(result?.id, 'replay-evt-001');
      assert.equal(result?.event.category, 'landslide');

      // Verify provenance structure
      assert.ok(result?.inputs.rainfall_24h.provenance);
      assert.equal(result?.inputs.rainfall_24h.provenance.type, 'SYNTHETIC');
      assert.equal(result?.inputs.slope.provenance.type, 'DERIVED');
      assert.equal(result?.inputs.historical_density.provenance.type, 'DERIVED');

      // Verify TALWEG risk assessment
      assert.ok(typeof result?.talweg.risk_score === 'number');
      assert.ok(['LOW', 'MODERATE', 'HIGH', 'SEVERE'].includes(result?.talweg.risk_level ?? ''));
      assert.equal(result?.talweg.engine, 'deterministic');
      assert.equal(
        result?.talweg.flagged,
        result?.talweg.risk_level === 'HIGH' || result?.talweg.risk_level === 'SEVERE'
      );
      assert.ok((result?.talweg.contributing_factors.length ?? 0) > 0);

      // Verify validation disclaimer
      assert.equal(result?.validation.status, 'synthetic_demo');
      assert.match(result?.validation.caveat ?? '', /not recorded historical weather/i);
    });

    it('returns null when replaying an invalid event id', async () => {
      const result = await replayHistoricalEvent('invalid-event-id');
      assert.equal(result, null);
    });
  });

  describe('buildValidationSummary()', () => {
    it('never fabricates metrics when ground truth is insufficient', async () => {
      const summary = await buildValidationSummary();
      assert.equal(summary.status, 'methodology_only');
      assert.equal(summary.metrics, null);
      assert.ok(summary.methodology_count >= 15);
      assert.match(summary.reason ?? '', /insufficient verified/i);
    });
  });
});
