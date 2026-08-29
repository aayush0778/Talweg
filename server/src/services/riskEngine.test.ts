import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateRisk,
  classifyRisk,
  normalize,
  RISK_WEIGHTS,
  NORMALIZATION_MAX,
  RiskInput,
} from '../services/riskEngine';

// ============================================================
// Unit Tests for the Deterministic Risk Engine
// ============================================================
// Run: npm test  (from server/)
// Uses Node.js built-in test runner — no extra test framework needed.
// ============================================================

describe('normalize()', () => {
  it('returns 0 for value 0', () => {
    assert.equal(normalize(0, 200), 0);
  });

  it('returns 1 for value equal to max', () => {
    assert.equal(normalize(200, 200), 1);
  });

  it('returns 0.5 for value at half of max', () => {
    assert.equal(normalize(100, 200), 0.5);
  });

  it('clamps to 1 for values exceeding max', () => {
    assert.equal(normalize(300, 200), 1);
  });

  it('clamps to 0 for negative values', () => {
    assert.equal(normalize(-10, 200), 0);
  });

  it('returns 0 for max of 0 (prevents division by zero)', () => {
    assert.equal(normalize(100, 0), 0);
  });

  it('returns 0 for negative max', () => {
    assert.equal(normalize(100, -50), 0);
  });
});

describe('classifyRisk()', () => {
  it('classifies 0.0 as LOW', () => {
    assert.equal(classifyRisk(0.0), 'LOW');
  });

  it('classifies 0.29 as LOW', () => {
    assert.equal(classifyRisk(0.29), 'LOW');
  });

  it('classifies 0.30 as LOW (boundary: <= 0.30)', () => {
    assert.equal(classifyRisk(0.30), 'LOW');
  });

  it('classifies 0.31 as MODERATE', () => {
    assert.equal(classifyRisk(0.31), 'MODERATE');
  });

  it('classifies 0.55 as MODERATE', () => {
    assert.equal(classifyRisk(0.55), 'MODERATE');
  });

  it('classifies 0.56 as MODERATE (boundary: <= 0.56)', () => {
    assert.equal(classifyRisk(0.56), 'MODERATE');
  });

  it('classifies 0.57 as HIGH', () => {
    assert.equal(classifyRisk(0.57), 'HIGH');
  });

  it('classifies 0.79 as HIGH', () => {
    assert.equal(classifyRisk(0.79), 'HIGH');
  });

  it('classifies 0.80 as HIGH (boundary: <= 0.80)', () => {
    assert.equal(classifyRisk(0.80), 'HIGH');
  });

  it('classifies 0.81 as SEVERE', () => {
    assert.equal(classifyRisk(0.81), 'SEVERE');
  });

  it('classifies 1.0 as SEVERE', () => {
    assert.equal(classifyRisk(1.0), 'SEVERE');
  });

  it('classifies values above 1.0 as SEVERE', () => {
    assert.equal(classifyRisk(1.5), 'SEVERE');
  });
});

describe('calculateRisk()', () => {
  it('returns a valid RiskResult with all required fields', () => {
    const input: RiskInput = {
      rainfall_24h: 100,
      rainfall_3d: 200,
      soil_moisture: 0.5,
      slope: 30,
      historical_density: 5,
    };
    const result = calculateRisk(input);

    assert.ok(typeof result.risk_score === 'number');
    assert.ok(typeof result.risk_level === 'string');
    assert.ok(Array.isArray(result.contributing_factors));
    assert.equal(result.engine, 'deterministic');
    assert.ok(typeof result.timestamp === 'string');
    assert.equal(result.contributing_factors.length, 5);
  });

  it('returns LOW risk for all-zero inputs', () => {
    const result = calculateRisk({
      rainfall_24h: 0,
      rainfall_3d: 0,
      soil_moisture: 0,
      slope: 0,
      historical_density: 0,
    });
    assert.equal(result.risk_score, 0);
    assert.equal(result.risk_level, 'LOW');
  });

  it('returns SEVERE risk for all-maximum inputs', () => {
    const result = calculateRisk({
      rainfall_24h: 200,
      rainfall_3d: 500,
      soil_moisture: 1.0,
      slope: 60,
      historical_density: 10,
    });
    assert.equal(result.risk_score, 1);
    assert.equal(result.risk_level, 'SEVERE');
  });

  it('still produces SEVERE for inputs exceeding maximums (clamped)', () => {
    const result = calculateRisk({
      rainfall_24h: 999,
      rainfall_3d: 999,
      soil_moisture: 2.0,
      slope: 90,
      historical_density: 50,
    });
    assert.equal(result.risk_score, 1);
    assert.equal(result.risk_level, 'SEVERE');
  });

  it('is deterministic — same inputs always produce same output', () => {
    const input: RiskInput = {
      rainfall_24h: 85,
      rainfall_3d: 180,
      soil_moisture: 0.78,
      slope: 35,
      historical_density: 5,
    };
    const r1 = calculateRisk(input);
    const r2 = calculateRisk(input);
    assert.equal(r1.risk_score, r2.risk_score);
    assert.equal(r1.risk_level, r2.risk_level);
    assert.deepEqual(
      r1.contributing_factors.map((f) => f.contribution),
      r2.contributing_factors.map((f) => f.contribution)
    );
  });

  it('correctly calculates a known mid-range scenario', () => {
    // Manual calculation:
    // rainfall_24h: 100/200 = 0.5, weight 0.30, contrib 0.150
    // rainfall_3d:  250/500 = 0.5, weight 0.20, contrib 0.100
    // slope:        30/60   = 0.5, weight 0.20, contrib 0.100
    // soil_moisture: 0.5/1  = 0.5, weight 0.15, contrib 0.075
    // historical:    5/10   = 0.5, weight 0.15, contrib 0.075
    // Total: 0.500
    const result = calculateRisk({
      rainfall_24h: 100,
      rainfall_3d: 250,
      soil_moisture: 0.5,
      slope: 30,
      historical_density: 5,
    });
    assert.equal(result.risk_score, 0.5);
    assert.equal(result.risk_level, 'MODERATE');
  });

  it('contributing_factors are sorted by contribution descending', () => {
    const result = calculateRisk({
      rainfall_24h: 150,
      rainfall_3d: 50,
      soil_moisture: 0.3,
      slope: 45,
      historical_density: 2,
    });
    for (let i = 1; i < result.contributing_factors.length; i++) {
      assert.ok(
        result.contributing_factors[i - 1].contribution >=
          result.contributing_factors[i].contribution,
        `Factor ${result.contributing_factors[i - 1].factor} should have >= contribution than ${result.contributing_factors[i].factor}`
      );
    }
  });

  it('weights sum to 1.0', () => {
    const sum = Object.values(RISK_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(sum - 1.0) < 0.001,
      `Weights sum to ${sum}, expected 1.0`
    );
  });

  it('each contributing_factor has correct weight from config', () => {
    const result = calculateRisk({
      rainfall_24h: 100,
      rainfall_3d: 200,
      soil_moisture: 0.5,
      slope: 30,
      historical_density: 5,
    });
    for (const factor of result.contributing_factors) {
      const expectedWeight =
        RISK_WEIGHTS[factor.factor as keyof typeof RISK_WEIGHTS];
      assert.equal(
        factor.weight,
        expectedWeight,
        `${factor.factor} weight should be ${expectedWeight}`
      );
    }
  });
});

describe('Rainfall scenario simulation', () => {
  const baseInput: RiskInput = {
    rainfall_24h: 50,
    rainfall_3d: 120,
    soil_moisture: 0.60,
    slope: 30,
    historical_density: 3,
  };

  it('increasing rainfall_24h increases the risk score', () => {
    const low = calculateRisk({ ...baseInput, rainfall_24h: 20 });
    const high = calculateRisk({ ...baseInput, rainfall_24h: 180 });
    assert.ok(
      high.risk_score > low.risk_score,
      `Score with 180mm (${high.risk_score}) should exceed score with 20mm (${low.risk_score})`
    );
  });

  it('can transition from MODERATE to HIGH by changing rainfall alone', () => {
    // With slope=35, moisture=0.70, density=5, rainfall_3d=250,
    // changing rainfall_24h should cross the HIGH threshold.
    const sharedInput = {
      rainfall_3d: 250,
      soil_moisture: 0.70,
      slope: 35,
      historical_density: 5,
    };
    const moderate = calculateRisk({ ...sharedInput, rainfall_24h: 30 });
    const high = calculateRisk({ ...sharedInput, rainfall_24h: 190 });
    assert.equal(moderate.risk_level, 'MODERATE', `Expected MODERATE at 30mm, got ${moderate.risk_level} (score: ${moderate.risk_score})`);
    assert.equal(high.risk_level, 'HIGH', `Expected HIGH at 190mm, got ${high.risk_level} (score: ${high.risk_score})`);
  });

  it('score changes proportionally to rainfall change', () => {
    const r1 = calculateRisk({ ...baseInput, rainfall_24h: 50 });
    const r2 = calculateRisk({ ...baseInput, rainfall_24h: 100 });
    const r3 = calculateRisk({ ...baseInput, rainfall_24h: 150 });

    const delta12 = r2.risk_score - r1.risk_score;
    const delta23 = r3.risk_score - r2.risk_score;

    // Both deltas should be equal (linear relationship)
    assert.ok(
      Math.abs(delta12 - delta23) < 0.01,
      `Deltas should be approximately equal: ${delta12} vs ${delta23}`
    );
  });
});

describe('Edge cases', () => {
  it('handles Gangtok seed data correctly', () => {
    // Using the actual seed values for Gangtok
    const result = calculateRisk({
      rainfall_24h: 85,
      rainfall_3d: 180,
      soil_moisture: 0.78,
      slope: 35,
      historical_density: 5,
    });
    assert.ok(result.risk_score > 0.3, `Gangtok should be at least MODERATE, got ${result.risk_score}`);
    assert.ok(result.risk_score < 0.8, `Gangtok with moderate rain shouldn't be SEVERE, got ${result.risk_score}`);
    assert.ok(
      result.risk_level === 'MODERATE' || result.risk_level === 'HIGH',
      `Gangtok should be MODERATE or HIGH, got ${result.risk_level}`
    );
  });

  it('handles Mangan seed data correctly (highest risk zone)', () => {
    const result = calculateRisk({
      rainfall_24h: 110,
      rainfall_3d: 240,
      soil_moisture: 0.85,
      slope: 38,
      historical_density: 3,
    });
    assert.ok(result.risk_score > 0.4, `Mangan should have elevated risk, got ${result.risk_score}`);
  });

  it('handles Namchi seed data correctly (lower risk zone)', () => {
    const result = calculateRisk({
      rainfall_24h: 45,
      rainfall_3d: 100,
      soil_moisture: 0.55,
      slope: 25,
      historical_density: 2,
    });
    assert.ok(result.risk_score < 0.5, `Namchi should be lower risk, got ${result.risk_score}`);
  });

  it('all normalization max values are positive', () => {
    for (const [key, val] of Object.entries(NORMALIZATION_MAX)) {
      assert.ok(val > 0, `NORMALIZATION_MAX.${key} must be positive, got ${val}`);
    }
  });
});
