import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getHazardProgression, getZonePredictiveRunout, ZONE_TOPOGRAPHIES } from './hazardProgression';

describe('Hazard Progression Service (hazardProgression.ts)', () => {
  it('returns verified hazard progression for October 4, 2023 Chungthang event', async () => {
    const progression = await getHazardProgression('replay-real-glc-2023-10-04');
    assert.ok(progression, 'Progression data should exist for real GLC event');
    assert.equal(progression.replay_id, 'replay-real-glc-2023-10-04');
    assert.equal(progression.zone_id, 'mangan');
    assert.equal(progression.event_date, '2023-10-04');
    assert.equal(progression.simulation_mode, 'historical_replay');
    assert.equal(progression.provenance_type, 'REAL');

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
    assert.equal(progression.timeline[0].phase, 'T-72h');
    assert.equal(progression.timeline[0].flow_progress, 0.0);
    assert.equal(progression.timeline[4].phase, 'EVENT');
    assert.equal(progression.timeline[4].flow_progress, 1.0);
    assert.ok(progression.geometry.flow_path.length > 0);
  });

  it('returns null for non-existent replay id', async () => {
    const progression = await getHazardProgression('non-existent-id-99999');
    assert.equal(progression, null);
  });

  it('generates distinct, valid predictive runouts for all 6 Sikkim zones', async () => {
    const zones = ['gangtok', 'mangan', 'namchi', 'pakyong', 'gyalshing', 'soreng'];

    for (const zoneId of zones) {
      const runout = await getZonePredictiveRunout(zoneId);
      assert.ok(runout, `Runout must exist for zone ${zoneId}`);
      assert.equal(runout.zone_id, zoneId);
      assert.equal(runout.simulation_mode, 'predictive_runout');
      assert.equal(runout.provenance_type, 'SIMULATED');

      // Topography flow path verification
      const topo = ZONE_TOPOGRAPHIES[zoneId];
      assert.ok(topo, `Zone topography definition must exist for ${zoneId}`);
      assert.deepEqual(runout.geometry.initiation_point, topo.flow_path[0]);
      assert.ok(runout.geometry.flow_path.length >= 5);

      // Verify authentic downhill elevation drop (first elev > last elev)
      const startElev = runout.geometry.flow_path[0][2];
      const endElev = runout.geometry.flow_path[runout.geometry.flow_path.length - 1][2];
      assert.ok(startElev > endElev, `Start elevation (${startElev}m) must be higher than end elevation (${endElev}m) for ${zoneId}`);

      // Verify corridor geometry
      assert.equal(runout.geometry.corridor_polygon.type, 'Feature');
      assert.equal(runout.geometry.corridor_polygon.geometry.type, 'Polygon');
      assert.equal(runout.geometry.deposition_polygon.type, 'Feature');
      assert.equal(runout.geometry.deposition_polygon.geometry.type, 'Polygon');

      // Verify 5 timeline steps with initial state at 0% progress
      assert.equal(runout.timeline.length, 5);
      const [t72, t48, t24, t6, eventStep] = runout.timeline;

      assert.equal(t72.phase, 'T-72h');
      assert.equal(t72.flow_progress, 0.0, 'Initial state at T-72h must have 0% flow progress');
      assert.ok(t72.risk_score >= 0 && t72.risk_score <= 1.0);

      assert.equal(t48.phase, 'T-48h');
      assert.equal(t24.phase, 'T-24h');
      assert.equal(t6.phase, 'T-6h');

      assert.equal(eventStep.phase, 'EVENT');
      assert.equal(eventStep.flow_progress, 1.0, 'Completed event step must have 100% flow progress');
    }
  });
});

