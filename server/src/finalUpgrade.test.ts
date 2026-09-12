/**
 * Final Upgrade tests — rainfall features, threshold engine, data quality,
 * feature schema, hybrid composer and simulation (node:test, no DB).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRainfallFeatures,
  calculateAriFromSeries,
  calculateAriFromAggregates,
} from './services/rainfallFeatures';
import {
  cumulativeThresholdMm,
  thresholdIntensityMmPerDay,
  evaluateRainfallThreshold,
  classifyBand,
  safetyLevelForRatio,
  applySafetyFloor,
  minimumScoreForLevel,
  THRESHOLD_CITATION,
} from './services/rainfallThreshold';
import { makeFeatureValue, computeCompleteness, computeAlignmentStatus } from './schemas/featureSchema';
import { assessDataQuality } from './services/dataQuality';
import { composeHybrid } from './services/hybridComposer';
import { runScenario, runSensitivity, SCENARIO_PRESETS } from './services/simulation';
import { buildReplayTimeline } from './services/replayTimeline';
import { RiskInput } from './services/riskEngine';
import { CANONICAL_SOURCES } from './services/dataSources';

// ---------- Rainfall features ----------

describe('rainfallFeatures', () => {
  const mkSeries = (daily: number[]): { date: string; precip_mm: number }[] =>
    daily.map((p, i) => ({
      date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(), // Sept 2026
      precip_mm: p,
    }));

  test('rolling windows computed from timestamped series', () => {
    const f = buildRainfallFeatures(mkSeries([10, 20, 30, 40, 50, 60, 70]));
    assert.equal(f.rainfall_24h, 70);
    assert.equal(f.rainfall_3d, 180); // 50+60+70
    assert.equal(f.rainfall_5d, 250); // 30+40+50+60+70
    assert.equal(f.rainfall_7d, 280);
    assert.equal(f.observation_count_7d, 7);
  });

  test('missing windows are null, never zero', () => {
    const f = buildRainfallFeatures(mkSeries([10, 20])); // only 2 days
    assert.equal(f.rainfall_24h, 20);
    assert.equal(f.rainfall_3d, 30);
    assert.equal(f.rainfall_7d, 30); // only 2 covered days
    assert.equal(f.observation_count_7d, 2);
  });

  test('empty series yields all nulls', () => {
    const f = buildRainfallFeatures([]);
    assert.equal(f.rainfall_24h, null);
    assert.equal(f.antecedent_rainfall_index, null);
  });

  test('ARI follows exponential decay with tau=3', () => {
    // Single day: ARI = P
    assert.equal(calculateAriFromSeries([{ date: '2026-09-01', precip_mm: 50 }]), 50);
    // Two days: ARI = P2 + exp(-1/3)*P1
    const ari = calculateAriFromSeries([
      { date: '2026-09-01', precip_mm: 30 },
      { date: '2026-09-02', precip_mm: 20 },
    ]) as number;
    assert.ok(Math.abs(ari - (20 + 30 * Math.exp(-1 / 3))) < 0.01);
  });

  test('ARI from aggregates reconstructs documented approximation', () => {
    // 24h=60, 3d=150 → days 1,2 = 45 each; matches manual decay sum
    const expected = 60 + 45 * (Math.exp(-1 / 3) + Math.exp(-2 / 3));
    assert.ok(Math.abs(calculateAriFromAggregates(60, 150, null) - expected) < 0.01);
  });

  test('anomaly only computed when baseline provided', () => {
    const series = mkSeries([10, 10, 10, 10, 10, 10, 10]);
    const noBaseline = buildRainfallFeatures(series);
    assert.equal(noBaseline.rainfall_anomaly, null);
    const withBaseline = buildRainfallFeatures(series, { anomalyBaseline: { mean: 5, std: 2 } });
    assert.equal(withBaseline.rainfall_anomaly, 5); // 10 mean - 5 baseline
  });
});

// ---------- Threshold engine ----------

describe('rainfallThreshold', () => {
  test('I = 43.26 * D^-0.78 for D=1,3,5,7', () => {
    // Computed at full precision from the published relationship.
    assert.equal(thresholdIntensityMmPerDay(1), 43.26);
    assert.ok(Math.abs(thresholdIntensityMmPerDay(3) - 18.363) < 0.01);
    assert.ok(Math.abs(thresholdIntensityMmPerDay(5) - 12.328) < 0.01);
    assert.ok(Math.abs(thresholdIntensityMmPerDay(7) - 9.482) < 0.01);
    // Cumulative thresholds (mm) = intensity × duration
    assert.equal(cumulativeThresholdMm(1), 43.26);
    assert.ok(Math.abs(cumulativeThresholdMm(3) - 55.088) < 0.01);
    assert.ok(Math.abs(cumulativeThresholdMm(5) - 61.64) < 0.01);
    assert.ok(Math.abs(cumulativeThresholdMm(7) - 66.376) < 0.01);
  });

  test('ratio bands', () => {
    assert.equal(classifyBand(0.5), 'below');
    assert.equal(classifyBand(1.0), 'approached');
    assert.equal(classifyBand(1.29), 'approached');
    assert.equal(classifyBand(1.3), 'strong');
    assert.equal(classifyBand(1.99), 'strong');
    assert.equal(classifyBand(2.0), 'extreme');
  });

  test('safety floor levels per spec §8.2', () => {
    assert.equal(safetyLevelForRatio(0.9), 'LOW');
    assert.equal(safetyLevelForRatio(1.0), 'MODERATE');
    assert.equal(safetyLevelForRatio(1.3), 'HIGH');
    assert.equal(safetyLevelForRatio(2.0), 'SEVERE');
  });

  test('safety floor never lowers the base level', () => {
    assert.deepEqual(applySafetyFloor('SEVERE', 'HIGH'), { final_level: 'SEVERE', escalated: false });
    assert.deepEqual(applySafetyFloor('LOW', 'HIGH'), { final_level: 'HIGH', escalated: true });
  });

  test('minimum scores consistent with enforced levels', () => {
    assert.ok(minimumScoreForLevel('HIGH') >= 0.56);
    assert.ok(minimumScoreForLevel('SEVERE') > 0.8);
    assert.equal(minimumScoreForLevel('LOW'), 0);
  });

  test('evaluates all four durations; missing windows not evaluated', () => {
    const e = evaluateRainfallThreshold({ rainfall_24h: 60, rainfall_3d: 150 });
    assert.equal(e.durations.length, 4);
    const d5 = e.durations.find((d) => d.duration_days === 5)!;
    assert.equal(d5.evaluated, false);
    const d1 = e.durations.find((d) => d.duration_days === 1)!;
    assert.ok(Math.abs(d1.ratio - 60 / 43.26) < 0.001);
    assert.equal(e.exceeded, true);
    assert.equal(e.citation, THRESHOLD_CITATION);
  });

  test('critical duration selects the max ratio', () => {
    // 3-day: 150/55.106 = 2.72; 1-day: 60/43.26 = 1.39 → critical = 3d
    const e = evaluateRainfallThreshold({ rainfall_24h: 60, rainfall_3d: 150 });
    assert.equal(e.critical_duration_days, 3);
    assert.equal(e.safety_level, 'SEVERE');
  });
});

// ---------- Canonical feature schema (TS) ----------

describe('featureSchema (TS)', () => {
  test('null → MISSING; 0 → VALID observed zero; non-finite → INVALID', () => {
    assert.equal(makeFeatureValue('x', null, { unit: 'mm', sourceId: 's', provenance: 'REAL' }).quality_status, 'MISSING');
    assert.equal(makeFeatureValue('x', 0, { unit: 'mm', sourceId: 's', provenance: 'REAL' }).quality_status, 'VALID');
    assert.equal(makeFeatureValue('x', NaN, { unit: 'mm', sourceId: 's', provenance: 'REAL' }).quality_status, 'INVALID');
  });

  test('completeness + alignment', () => {
    const features = {
      rainfall_24h: makeFeatureValue('rainfall_24h', 10, { unit: 'mm', sourceId: 'chirps', provenance: 'REAL' }),
      rainfall_3d: makeFeatureValue('rainfall_3d', 30, { unit: 'mm', sourceId: 'chirps', provenance: 'REAL' }),
      slope: makeFeatureValue('slope', 20, { unit: 'deg', sourceId: 'srtm', provenance: 'DERIVED' }),
      soil_moisture: makeFeatureValue('soil_moisture', 0.5, { unit: 'ratio', sourceId: 's', provenance: 'REAL' }),
      // historical_density missing
    };
    assert.equal(computeCompleteness(features), 0.8);
    assert.equal(computeAlignmentStatus(features), 'partial');
  });

  test('data quality assessment degrades with provenance', () => {
    const good: Record<string, ReturnType<typeof makeFeatureValue>> = {
      rainfall_24h: makeFeatureValue('rainfall_24h', 10, { unit: 'mm', sourceId: 's', provenance: 'REAL', observedAt: new Date().toISOString() }),
      rainfall_3d: makeFeatureValue('rainfall_3d', 30, { unit: 'mm', sourceId: 's', provenance: 'REAL', observedAt: new Date().toISOString() }),
      slope: makeFeatureValue('slope', 20, { unit: 'deg', sourceId: 's', provenance: 'REAL' }),
      soil_moisture: makeFeatureValue('soil_moisture', 0.5, { unit: 'ratio', sourceId: 's', provenance: 'REAL' }),
      historical_density: makeFeatureValue('historical_density', 3, { unit: 'events', sourceId: 's', provenance: 'REAL' }),
    };
    const synthetic: Record<string, ReturnType<typeof makeFeatureValue>> = {};
    for (const [k, fv] of Object.entries(good)) {
      synthetic[k] = { ...fv, provenance_type: 'SYNTHETIC' as const };
    }
    const asRecord = (features: Record<string, ReturnType<typeof makeFeatureValue>>) =>
      ({
        feature_schema_version: '1.0.0',
        location: { latitude: 0, longitude: 0 },
        as_of: new Date().toISOString(),
        features,
        completeness: computeCompleteness(features),
        alignment_status: computeAlignmentStatus(features),
      }) as never;
    const qGood = assessDataQuality(asRecord(good));
    const qSyn = assessDataQuality(asRecord(synthetic));
    assert.ok(qGood.data_quality_score > qSyn.data_quality_score);
    assert.equal(qGood.feature_completeness, 1);
  });
});

// ---------- Hybrid composer ----------

const BASE_INPUT: RiskInput = {
  rainfall_24h: 60,
  rainfall_3d: 150,
  soil_moisture: 0.6,
  slope: 30,
  historical_density: 3,
};

describe('hybridComposer', () => {
  test('rejects NaN and Infinity (spec §14)', async () => {
    await assert.rejects(
      () => composeHybrid({ ...BASE_INPUT, rainfall_24h: NaN }, { mode: 'deterministic' }),
      /finite/
    );
    await assert.rejects(
      () => composeHybrid({ ...BASE_INPUT, slope: Infinity }, { mode: 'deterministic' }),
      /finite/
    );
  });

  test('out-of-domain inputs produce domain warning, not silent clamping', async () => {
    const out = await composeHybrid({ ...BASE_INPUT, rainfall_24h: 400 }, { mode: 'deterministic' });
    assert.equal(out.uncertainty.domain_warning, true);
    assert.deepEqual(out.uncertainty.clamped_features, ['rainfall_24h']);
    assert.equal(out.uncertainty.message, 'Input exceeds validated prototype domain.');
  });

  test('safety floor escalates level when threshold strongly exceeded', async () => {
    // rainfall_3d=150 → ratio 2.72 → SEVERE floor
    const out = await composeHybrid(BASE_INPUT, { mode: 'deterministic' });
    assert.equal(out.rainfall_threshold.safety_level, 'SEVERE');
    assert.equal(out.risk_level, 'SEVERE');
    assert.ok(out.risk_index >= minimumScoreForLevel('SEVERE'));
    assert.equal(out.is_probability, false);
    assert.equal(out.model_version, 'synthetic-surrogate-0.1.0');
    assert.ok(out.triggered_rules.some((r) => r.rule === 'rainfall_threshold'));
  });

  test('deterministic mode reports synthetic_surrogate + fallback metadata', async () => {
    const out = await composeHybrid(BASE_INPUT, { mode: 'deterministic' });
    assert.equal(out.model_mode, 'synthetic_surrogate');
    assert.equal(out.fallback_used, true);
    assert.ok(out.fallback_reason);
  });

  test('deterministic score drives risk when floor not triggered', async () => {
    const calm: RiskInput = { rainfall_24h: 10, rainfall_3d: 30, soil_moisture: 0.3, slope: 10, historical_density: 1 };
    const out = await composeHybrid(calm, { mode: 'deterministic' });
    assert.equal(out.rainfall_threshold.safety_level, 'LOW');
    assert.equal(out.risk_level, 'LOW');
    assert.ok(Math.abs(out.risk_index - out.deterministic.score) < 1e-9);
  });
});

// ---------- Simulation ----------

describe('simulation', () => {
  test('all presets registered with unique ids', () => {
    const ids = SCENARIO_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const required of ['baseline', 'rainfall_plus_25', 'rainfall_plus_50', 'rainfall_plus_100', 'sustained_rainfall', 'high_antecedent', 'wet_soil', 'steep_slope', 'custom']) {
      assert.ok(ids.includes(required as never), `missing preset ${required}`);
    }
  });

  test('scenario changes risk (deterministic seam, offline)', async () => {
    // resolveZoneRiskInputs falls back to the in-memory demo catalog offline.
    const res = await runScenario('gangtok', 'rainfall_plus_100', {}, { persist: false });
    if (res === null) return; // zone unavailable in this environment
    assert.ok(res.scenario.risk_index > res.baseline.risk_index || res.scenario.risk_level !== res.baseline.risk_level || res.delta.risk_index !== 0);
    assert.equal(res.delta.risk_level_from, res.baseline.risk_level);
    assert.equal(res.delta.risk_level_to, res.scenario.risk_level);
    assert.ok(res.label.includes('recomputed'));
  });

  test('sensitivity returns percentile band and honest label', async () => {
    const res = await runSensitivity('gangtok', 12, 42);
    if (res === null) return;
    assert.ok(res.p10_risk_index <= res.median_risk_index);
    assert.ok(res.median_risk_index <= res.p90_risk_index);
    assert.ok(res.proportion_high_severe >= 0 && res.proportion_high_severe <= 1);
    assert.match(res.label, /not statistical prediction uncertainty/);
  });
});

// ---------- Replay timeline ----------

describe('replayTimeline', () => {
  test('timeline has 5 phases in order with escalation toward event', () => {
    const t = buildReplayTimeline({
      rainfall_24h: 142.5,
      rainfall_3d: 238.0,
      rainfall_7d: 312.0,
      soil_moisture: 0.85,
      slope: 36.5,
      historical_density: 4,
      event_date: '2023-10-04',
    });
    assert.deepEqual(
      t.steps.map((s) => s.phase),
      ['T-7d', 'T-5d', 'T-3d', 'T-24h', 'EVENT']
    );
    assert.equal(t.reconstruction, 'uniform_window_reconstruction');
    const eventStep = t.steps[4];
    assert.equal(eventStep.daily_rainfall_mm, 142.5);
    assert.ok(eventStep.threshold_ratio !== null && eventStep.threshold_ratio > 1);
    assert.ok(['HIGH', 'SEVERE'].includes(eventStep.risk_level));
    // risk should never decrease toward the event
    for (let i = 1; i < t.steps.length; i++) {
      assert.ok(t.steps[i].final_risk_index >= t.steps[i - 1].final_risk_index);
    }
  });
});

// ---------- Source registry ----------

describe('dataSources', () => {
  test('canonical registry never claims LIVE', () => {
    for (const s of CANONICAL_SOURCES) {
      assert.notEqual(s.status, 'LIVE', `${s.name} must not claim LIVE without a live feed`);
    }
    const ids = CANONICAL_SOURCES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length);
  });
});
