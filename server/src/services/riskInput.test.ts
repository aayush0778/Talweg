import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRiskInput, ObservationRow } from './riskInput';

describe('resolveRiskInput (Unit Tests)', () => {
  const sampleObs: ObservationRow = {
    rainfall_24h: 85,
    rainfall_3d: 180,
    soil_moisture: 0.78,
    slope: 35,
    source: 'synthetic_seed',
  };

  it('resolves input cleanly from observation and eventCount with empty overrides', () => {
    const result = resolveRiskInput(sampleObs, 30, 5, {});
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.input.rainfall_24h, 85);
      assert.equal(result.input.rainfall_3d, 180);
      assert.equal(result.input.soil_moisture, 0.78);
      assert.equal(result.input.slope, 35);
      assert.equal(result.input.historical_density, 5);
    }
  });

  it('allows overrides to take precedence over observation values', () => {
    const result = resolveRiskInput(sampleObs, 30, 5, {
      rainfall_24h: 150,
      soil_moisture: 0.95,
      historical_density: 8,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.input.rainfall_24h, 150);
      assert.equal(result.input.rainfall_3d, 180); // Stored value preserved
      assert.equal(result.input.soil_moisture, 0.95);
      assert.equal(result.input.historical_density, 8); // Overridden
    }
  });

  it('falls back to zone base_slope when observation slope is null', () => {
    const obsWithoutSlope: ObservationRow = {
      ...sampleObs,
      slope: null,
    };
    const result = resolveRiskInput(obsWithoutSlope, 28.5, 3, {});
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.input.slope, 28.5);
    }
  });

  it('reports missing fields when observation is null and overrides are incomplete', () => {
    const result = resolveRiskInput(null, 30, 0, {
      rainfall_24h: 100,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.deepEqual(result.missing.sort(), ['rainfall_3d', 'soil_moisture'].sort());
    }
  });

  it('succeeds with null observation if all missing fields are supplied via overrides', () => {
    const result = resolveRiskInput(null, 35, 2, {
      rainfall_24h: 120,
      rainfall_3d: 250,
      soil_moisture: 0.85,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.input.rainfall_24h, 120);
      assert.equal(result.input.rainfall_3d, 250);
      assert.equal(result.input.soil_moisture, 0.85);
      assert.equal(result.input.slope, 35); // From base_slope
      assert.equal(result.input.historical_density, 2);
    }
  });
});
