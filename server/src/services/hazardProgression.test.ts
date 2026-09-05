import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHazardProgression } from './hazardProgression';

describe('Hazard Progression Service (hazardProgression.ts)', () => {
  it('returns verified hazard progression for October 4, 2023 Chungthang event', async () => {
    const progression = await getHazardProgression('replay-real-glc-2023-10-04');
    assert.ok(progression, 'Progression data should exist for real GLC event');
    assert.equal(progression.replay_id, 'replay-real-glc-2023-10-04');
    assert.equal(progression.zone_id, 'mangan');
    assert.equal(progression.event_date, '2023-10-04');

    // 5 timeline steps
    assert.equal(progression.timeline.length, 5);
    const [t72, t48, t24, t6, event] = progression.timeline;

    assert.equal(t72.phase, 'T-72h');
    assert.equal(t72.threshold_crossed, false);
    assert.equal(t72.flow_progress, 0.0);

    assert.equal(t48.phase, 'T-48h');
    assert.equal(t48.threshold_crossed, false);

    assert.equal(t24.phase, 'T-24h');
    assert.equal(t24.threshold_crossed, false);

    assert.equal(t6.phase, 'T-6h');
    assert.equal(t6.threshold_crossed, true);
    assert.equal(t6.risk_level, 'HIGH');
    assert.ok(t6.risk_score >= 0.56, 'T-6h risk score must cross 0.56 threshold');

    assert.equal(event.phase, 'EVENT');
    assert.equal(event.threshold_crossed, true);
    assert.equal(event.flow_progress, 1.0);
    assert.equal(event.risk_score, 0.62);

    // Corridor geometry
    assert.ok(progression.geometry.flow_path.length >= 5);
    assert.equal(progression.geometry.historical_event_point[0], 88.528);
    assert.equal(progression.geometry.historical_event_point[1], 27.516);
    assert.equal(progression.geometry.corridor_polygon.type, 'Feature');
    assert.equal(progression.geometry.corridor_polygon.geometry.type, 'Polygon');

    // Disclaimer
    assert.ok(progression.disclaimer.includes('ILLUSTRATIVE TERRAIN-BASED MOVEMENT SIMULATION'));
  });

  it('generates synthetic progression for non-anchor replay records', async () => {
    const progression = await getHazardProgression('replay-evt-001');
    assert.ok(progression, 'Synthetic replay should have progression');
    assert.equal(progression.timeline.length, 5);
    assert.equal(progression.timeline[4].phase, 'EVENT');
    assert.equal(progression.timeline[4].flow_progress, 1.0);
    assert.ok(progression.geometry.flow_path.length > 0);
  });

  it('returns null for non-existent replay id', async () => {
    const progression = await getHazardProgression('non-existent-id-99999');
    assert.equal(progression, null);
  });
});
