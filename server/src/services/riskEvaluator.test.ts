import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRisk } from './riskEvaluator';
import { RiskInput, RiskResult } from './riskEngine';

describe('Risk Evaluator & Failover Seam (riskEvaluator.test.ts)', () => {
  const sampleInput: RiskInput = {
    rainfall_24h: 85.0,
    rainfall_3d: 180.0,
    soil_moisture: 0.78,
    slope: 35.0,
    historical_density: 5,
  };

  const moderateInput: RiskInput = {
    rainfall_24h: 20.0,
    rainfall_3d: 40.0,
    soil_moisture: 0.50,
    slope: 25.0,
    historical_density: 2,
  };

  it('calls ML predictor when mode is "ml" and returns ML result when within thresholds', async () => {
    const mockMlPredict = async (input: RiskInput): Promise<RiskResult> => ({
      risk_score: 0.35,
      risk_level: 'MODERATE',
      contributing_factors: [
        { factor: 'rainfall_24h', raw: input.rainfall_24h, normalized: 0.1, weight: 0.3, contribution: 0.03 },
      ],
      engine: 'ml',
      timestamp: new Date().toISOString(),
    });

    const result = await evaluateRisk(moderateInput, {
      mode: 'ml',
      mlPredict: mockMlPredict,
    });

    assert.equal(result.engine, 'ml');
    assert.equal(result.risk_score, 0.35);
    assert.equal(result.risk_level, 'MODERATE');
    assert.equal(result.fallback_used, false);
    assert.equal(result.fallback_reason, null);
    assert.equal(typeof result.ml_vs_deterministic_delta, 'number');
  });

  it('enforces hybrid safety floor when physical rainfall threshold exceeds surrogate score', async () => {
    // Under extreme physical rainfall (85mm 24h, 180mm 3d), surrogate underpredicting as LOW/MODERATE must be overridden
    const mockUnderpredictingMl = async (): Promise<RiskResult> => ({
      risk_score: 0.20,
      risk_level: 'LOW',
      contributing_factors: [],
      engine: 'ml',
      timestamp: new Date().toISOString(),
    });

    const result = await evaluateRisk(sampleInput, {
      mode: 'ml',
      mlPredict: mockUnderpredictingMl,
    });

    assert.equal(result.engine, 'hybrid');
    assert.equal(result.safety_override, true);
    assert.ok(result.risk_score >= 0.81);
    assert.equal(result.risk_level, 'SEVERE');
  });

  it('falls back to deterministic engine when ML service fails without throwing', async () => {
    const failingMlPredict = async (): Promise<RiskResult> => {
      throw new Error('Connection refused to http://localhost:8000/predict');
    };

    const result = await evaluateRisk(sampleInput, {
      mode: 'ml',
      mlPredict: failingMlPredict,
    });

    // Seamlessly fell back
    assert.equal(result.engine, 'deterministic');
    assert.equal(result.risk_level, 'MODERATE');
    assert.equal(result.risk_score, 0.508);
    assert.equal(result.contributing_factors.length, 5);
    assert.equal(result.fallback_used, true);
    assert.ok(result.fallback_reason?.includes('Connection refused'));
    assert.equal(result.is_probability, false);
  });

  it('uses deterministic engine directly when mode is "deterministic"', async () => {
    let mlCalled = false;
    const mockMlPredict = async (): Promise<RiskResult> => {
      mlCalled = true;
      throw new Error('Should not be called');
    };

    const result = await evaluateRisk(sampleInput, {
      mode: 'deterministic',
      mlPredict: mockMlPredict,
    });

    assert.equal(mlCalled, false);
    assert.equal(result.engine, 'deterministic');
    assert.equal(result.risk_score, 0.508);
  });

  it('preserves valid RiskResult shape across both modes', async () => {
    const detResult = await evaluateRisk(moderateInput, { mode: 'deterministic' });

    const mockMlPredict = async (): Promise<RiskResult> => ({
      ...detResult,
      engine: 'ml',
    });

    const mlResult = await evaluateRisk(moderateInput, {
      mode: 'ml',
      mlPredict: mockMlPredict,
    });

    assert.equal(typeof mlResult.risk_score, 'number');
    assert.equal(typeof mlResult.risk_level, 'string');
    assert.ok(Array.isArray(mlResult.contributing_factors));
    assert.equal(mlResult.engine, 'ml');
  });
});
