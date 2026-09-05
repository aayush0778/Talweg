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
    it('returns replay records prioritizing real historical events followed by synthetic events', async () => {
      const replays = await listHistoricalReplays();
      assert.ok(Array.isArray(replays));
      assert.ok(replays.length >= 16);
      
      // Verified real historical event is first
      assert.equal(replays[0].id, 'replay-real-glc-2023-10-04');
      assert.equal(replays[0].data_quality, 'real_replay');
      assert.match(replays[0].source, /NASA GLC/i);

      // Synthetic demo events follow
      assert.ok(replays[1].id.startsWith('replay-evt-'));
      assert.equal(replays[1].source, 'synthetic_seed');
      assert.equal(replays[1].data_quality, 'synthetic_demo');
    });
  });

  describe('getHistoricalReplayById() in-memory fallback', () => {
    it('finds verified real replay by replay-real-glc-2023-10-04 ID', async () => {
      const replay = await getHistoricalReplayById('replay-real-glc-2023-10-04');
      assert.ok(replay);
      assert.equal(replay?.id, 'replay-real-glc-2023-10-04');
      assert.equal(replay?.event_id, 'glc-15243');
      assert.equal(replay?.zone_id, 'mangan');
      assert.equal(replay?.data_quality, 'real_replay');
    });

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
    it('replays verified real GLC event with REAL/DERIVED provenance and WOULD HAVE FLAGGED: YES', async () => {
      const result = await replayHistoricalEvent('replay-real-glc-2023-10-04');
      assert.ok(result);
      assert.equal(result?.id, 'replay-real-glc-2023-10-04');
      assert.equal(result?.event.category, 'debris_flow');

      // Verify authentic provenance structure
      assert.equal(result?.event.source.type, 'REAL');
      assert.equal(result?.inputs.rainfall_24h.provenance.type, 'REAL');
      assert.equal(result?.inputs.rainfall_3d.provenance.type, 'DERIVED');
      assert.equal(result?.inputs.rainfall_7d.provenance.type, 'DERIVED');
      assert.equal(result?.inputs.slope.provenance.type, 'DERIVED');
      assert.equal(result?.inputs.soil_moisture.provenance.type, 'DERIVED');
      assert.equal(result?.inputs.historical_density.provenance.type, 'DERIVED');

      // Verify deterministic risk score >= 0.56 (HIGH)
      assert.ok(typeof result?.talweg.risk_score === 'number');
      assert.ok(result?.talweg.risk_score >= 0.56, `Risk score was ${result?.talweg.risk_score}`);
      assert.equal(result?.talweg.risk_level, 'HIGH');
      assert.equal(result?.talweg.flagged, true); // WOULD HAVE FLAGGED: YES
      assert.equal(result?.talweg.engine, 'deterministic');

      // Verify real replay validation caveat
      assert.equal(result?.validation.status, 'real_replay');
      assert.match(result?.validation.caveat ?? '', /NASA GLC/i);
    });

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
      assert.ok(summary.methodology_count >= 16);
      assert.equal(summary.real_replay_count, 1);
      assert.match(summary.reason ?? '', /insufficient verified/i);
    });
  });
});
