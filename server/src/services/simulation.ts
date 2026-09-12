/**
 * Simulation Engine (Final Upgrade Spec §17)
 *
 * Scenario simulation MODIFIES ACTUAL MODEL INPUTS and recomputes risk
 * through the hybrid composer — it is never a random animation.
 *
 * Scenario modes (§17.2): baseline, +25/50/100% rainfall, sustained rainfall,
 * high antecedent, wet soil, steep slope, custom.
 * Sensitivity mode (§17.4): controlled perturbations (rainfall ±10%,
 * soil moisture ±10%, slope ±5%), N runs, median/p10/p90 and proportion of
 * scenarios reaching HIGH/SEVERE. Labeled "Scenario sensitivity, not
 * statistical prediction uncertainty."
 */

import { query } from '../db/query';
import { RiskInput } from './riskEngine';
import { composeHybrid, HybridRiskOutput } from './hybridComposer';
import { resolveZoneRiskInputs, RiskInputOverrides } from './zoneRiskInputs';

export type ScenarioPresetId =
  | 'baseline'
  | 'rainfall_plus_25'
  | 'rainfall_plus_50'
  | 'rainfall_plus_100'
  | 'sustained_rainfall'
  | 'high_antecedent'
  | 'wet_soil'
  | 'steep_slope'
  | 'custom';

export interface ScenarioPreset {
  id: ScenarioPresetId;
  label: string;
  description: string;
  /** transform applied to the resolved baseline inputs */
  build: (base: RiskInput) => RiskInputOverrides;
}

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    description: 'Current observed conditions — no overrides',
    build: () => ({}),
  },
  {
    id: 'rainfall_plus_25',
    label: '+25% Rainfall',
    description: 'All rainfall windows scaled by 1.25×',
    build: (b) => ({
      rainfall_24h: round(b.rainfall_24h * 1.25),
      rainfall_3d: round(b.rainfall_3d * 1.25),
      ...(b.rainfall_5d != null ? { rainfall_5d: round(b.rainfall_5d * 1.25) } : {}),
      ...(b.rainfall_7d != null ? { rainfall_7d: round(b.rainfall_7d * 1.25) } : {}),
    }),
  },
  {
    id: 'rainfall_plus_50',
    label: '+50% Rainfall',
    description: 'All rainfall windows scaled by 1.5×',
    build: (b) => ({
      rainfall_24h: round(b.rainfall_24h * 1.5),
      rainfall_3d: round(b.rainfall_3d * 1.5),
      ...(b.rainfall_5d != null ? { rainfall_5d: round(b.rainfall_5d * 1.5) } : {}),
      ...(b.rainfall_7d != null ? { rainfall_7d: round(b.rainfall_7d * 1.5) } : {}),
    }),
  },
  {
    id: 'rainfall_plus_100',
    label: '+100% Rainfall',
    description: 'All rainfall windows doubled',
    build: (b) => ({
      rainfall_24h: round(b.rainfall_24h * 2),
      rainfall_3d: round(b.rainfall_3d * 2),
      ...(b.rainfall_5d != null ? { rainfall_5d: round(b.rainfall_5d * 2) } : {}),
      ...(b.rainfall_7d != null ? { rainfall_7d: round(b.rainfall_7d * 2) } : {}),
    }),
  },
  {
    id: 'sustained_rainfall',
    label: 'Sustained Rainfall',
    description: '3d/5d/7d windows pushed toward consecutive heavy rain',
    build: (b) => ({
      rainfall_24h: round(Math.max(b.rainfall_24h, 60)),
      rainfall_3d: round(Math.max(b.rainfall_3d, 180)),
      rainfall_7d: round(Math.max(b.rainfall_7d ?? 0, 320)),
    }),
  },
  {
    id: 'high_antecedent',
    label: 'High Antecedent Rainfall',
    description: 'Wet antecedent week: 7d window raised, 24h held',
    build: (b) => ({
      rainfall_7d: round(Math.max(b.rainfall_7d ?? b.rainfall_3d * 1.5, 350)),
      rainfall_3d: round(Math.max(b.rainfall_3d, 140)),
    }),
  },
  {
    id: 'wet_soil',
    label: 'Wet Soil Scenario',
    description: 'Soil moisture raised to 0.9 (near saturation)',
    build: () => ({ soil_moisture: 0.9 }),
  },
  {
    id: 'steep_slope',
    label: 'Steep-Slope Scenario',
    description: 'Slope raised by 10° (terrain interaction stress test)',
    build: (b) => ({ slope: round(Math.min(60, b.slope + 10)) }),
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Manual overrides supplied in the request',
    build: () => ({}),
  },
];

export const SENSITIVITY_LABEL =
  'Scenario sensitivity, not statistical prediction uncertainty.';

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface SimulationResponse {
  scenario_id: string;
  zone_id: string;
  zone_name: string;
  baseline: HybridRiskOutput;
  scenario: HybridRiskOutput;
  delta: {
    risk_index: number;
    risk_level_from: string;
    risk_level_to: string;
    threshold_ratio_change: number | null;
  };
  largest_change_driver: { feature: string; baseline_value: number; scenario_value: number; delta: number } | null;
  threshold_ratio: number | null;
  model_mode: string;
  data_quality: HybridRiskOutput['data_quality'];
  label: string;
  timestamp: string;
}

export interface SensitivityResponse {
  zone_id: string;
  zone_name: string;
  n_runs: number;
  perturbations: { rainfall: number; soil_moisture: number; slope: number };
  median_risk_index: number;
  p10_risk_index: number;
  p90_risk_index: number;
  proportion_high_severe: number;
  min_risk_index: number;
  max_risk_index: number;
  label: string;
  timestamp: string;
}

/** Largest absolute change across the editable physical inputs. */
function findLargestDriver(
  base: RiskInput,
  overrides: RiskInputOverrides
): SimulationResponse['largest_change_driver'] {
  const candidates: { feature: string; from: number; to: number }[] = [];
  const check = (feature: keyof RiskInput, key: keyof RiskInputOverrides) => {
    const from = base[feature] as number | undefined;
    const to = overrides[key] as number | undefined;
    if (typeof from === 'number' && typeof to === 'number' && from !== to) {
      candidates.push({ feature: String(feature), from, to });
    }
  };
  check('rainfall_24h', 'rainfall_24h');
  check('rainfall_3d', 'rainfall_3d');
  check('rainfall_5d', 'rainfall_5d');
  check('rainfall_7d', 'rainfall_7d');
  check('soil_moisture', 'soil_moisture');
  check('slope', 'slope');
  check('historical_density', 'historical_density');

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from));
  const top = candidates[0];
  return {
    feature: top.feature,
    baseline_value: top.from,
    scenario_value: top.to,
    delta: Math.round((top.to - top.from) * 1000) / 1000,
  };
}

function thresholdRatioOf(r: HybridRiskOutput): number | null {
  return r.rainfall_threshold.ratio;
}

function persistRun(response: SimulationResponse, preset: ScenarioPresetId, baseInputs: RiskInput, overrides: RiskInputOverrides): void {
  // Best-effort persistence — never blocks the simulation response.
  query(
    `INSERT INTO simulation_runs
       (scenario_id, zone_id, mode, preset, base_inputs, override_inputs,
        baseline_result, scenario_result, delta, model_mode, threshold_ratio)
     VALUES ($1,$2,'scenario',$3,$4,$5,$6,$7,$8,$9,$10);`,
    [
      response.scenario_id,
      response.zone_id,
      preset,
      JSON.stringify(baseInputs),
      JSON.stringify(overrides),
      JSON.stringify({
        risk_index: response.baseline.risk_index,
        risk_level: response.baseline.risk_level,
      }),
      JSON.stringify({
        risk_index: response.scenario.risk_index,
        risk_level: response.scenario.risk_level,
      }),
      response.delta.risk_index,
      response.model_mode,
      response.threshold_ratio,
    ]
  ).catch((err) => {
    console.warn('[simulation] persistence skipped:', err instanceof Error ? err.message : err);
  });
}

/**
 * Run a scenario: resolve zone inputs, compose baseline and scenario risk
 * through the full hybrid pipeline, and compute the comparison metadata.
 */
export async function runScenario(
  zoneId: string,
  preset: ScenarioPresetId = 'custom',
  overrides: RiskInputOverrides = {},
  opts: { persist?: boolean } = {}
): Promise<SimulationResponse | null> {
  const resolved = await resolveZoneRiskInputs(zoneId);
  if (!resolved.ok || !resolved.input) {
    return null;
  }
  const baseInput = resolved.input;

  // Named presets expand their own overrides from the baseline inputs
  // (explicit request overrides win over the preset on conflicts).
  const presetDef = SCENARIO_PRESETS.find((p) => p.id === preset);
  let effectiveOverrides = overrides;
  if (presetDef && preset !== 'custom' && preset !== 'baseline') {
    effectiveOverrides = { ...presetDef.build(baseInput), ...overrides };
  }

  const baseline = await composeHybrid(baseInput, {
    provenanceByFeature: resolved.provenanceByFeature,
    rainfallProvenance: resolved.rainfallProvenance,
    rainfallSourceId: resolved.rainfallSourceId,
  });

  const scenarioInput: RiskInput = { ...baseInput, ...effectiveOverrides };
  const scenario = await composeHybrid(scenarioInput, {
    provenanceByFeature: Object.fromEntries(
      Object.entries(resolved.provenanceByFeature).map(([k, v]) => [
        k,
        effectiveOverrides[k as keyof RiskInputOverrides] !== undefined ? ('SYNTHETIC' as const) : v,
      ])
    ),
    rainfallProvenance:
      effectiveOverrides.rainfall_24h !== undefined || effectiveOverrides.rainfall_3d !== undefined
        ? 'SYNTHETIC'
        : resolved.rainfallProvenance,
    rainfallSourceId: resolved.rainfallSourceId,
  });

  const response: SimulationResponse = {
    scenario_id: `sim-${zoneId}-${preset}-${Date.now()}`,
    zone_id: zoneId,
    zone_name: resolved.context?.zone_name ?? zoneId,
    baseline,
    scenario,
    delta: {
      risk_index:
        Math.round((scenario.risk_index - baseline.risk_index) * 1000) / 1000,
      risk_level_from: baseline.risk_level,
      risk_level_to: scenario.risk_level,
      threshold_ratio_change:
        thresholdRatioOf(scenario) !== null && thresholdRatioOf(baseline) !== null
          ? Math.round((thresholdRatioOf(scenario)! - thresholdRatioOf(baseline)!) * 1000) / 1000
          : null,
    },
    largest_change_driver: findLargestDriver(baseInput, effectiveOverrides),
    threshold_ratio: thresholdRatioOf(scenario),
    model_mode: scenario.model_mode,
    data_quality: scenario.data_quality,
    label: 'Scenario simulation — model inputs modified and risk recomputed',
    timestamp: new Date().toISOString(),
  };

  if (opts.persist !== false && presetDef) {
    persistRun(response, preset, baseInput, overrides);
  }

  return response;
}

// ----- Sensitivity (Monte-Carlo-style controlled perturbation) -----

/** Deterministic PRNG (mulberry32) — reproducible sensitivity runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SENSITIVITY_DEFAULTS = {
  n_runs: 40,
  max_runs: 200,
  rainfall: 0.10, // ±10%
  soil_moisture: 0.10, // ±10%
  slope: 0.05, // ±5%
};

export async function runSensitivity(
  zoneId: string,
  nRuns: number = SENSITIVITY_DEFAULTS.n_runs,
  seed: number = 42
): Promise<SensitivityResponse | null> {
  const resolved = await resolveZoneRiskInputs(zoneId);
  if (!resolved.ok || !resolved.input) return null;

  const base = resolved.input;
  const n = Math.max(2, Math.min(nRuns, SENSITIVITY_DEFAULTS.max_runs));
  const rand = mulberry32(seed);

  const scores: number[] = [];
  for (let i = 0; i < n; i++) {
    const perturbed: RiskInput = {
      ...base,
      rainfall_24h: round(base.rainfall_24h * (1 + (rand() * 2 - 1) * SENSITIVITY_DEFAULTS.rainfall)),
      rainfall_3d: round(base.rainfall_3d * (1 + (rand() * 2 - 1) * SENSITIVITY_DEFAULTS.rainfall)),
      soil_moisture: Math.max(0, Math.min(1, base.soil_moisture * (1 + (rand() * 2 - 1) * SENSITIVITY_DEFAULTS.soil_moisture))),
      slope: Math.max(0, base.slope * (1 + (rand() * 2 - 1) * SENSITIVITY_DEFAULTS.slope)),
    };
    // Compose with deterministic engine seam for speed — the deterministic
    // baseline drives sensitivity shape; threshold floor still applies via composer.
    const result = await composeHybrid(perturbed, {
      provenanceByFeature: resolved.provenanceByFeature,
      rainfallProvenance: resolved.rainfallProvenance,
      rainfallSourceId: resolved.rainfallSourceId,
      mode: 'deterministic',
    });
    scores.push(result.risk_index);
  }

  scores.sort((a, b) => a - b);
  const quantile = (q: number): number => {
    const pos = (scores.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    const value = lo === hi ? scores[lo] : scores[lo] + (scores[hi] - scores[lo]) * (pos - lo);
    return Math.round(value * 1000) / 1000;
  };

  const highSevere = scores.filter((s) => s > 0.56).length;

  return {
    zone_id: zoneId,
    zone_name: resolved.context?.zone_name ?? zoneId,
    n_runs: scores.length,
    perturbations: {
      rainfall: SENSITIVITY_DEFAULTS.rainfall,
      soil_moisture: SENSITIVITY_DEFAULTS.soil_moisture,
      slope: SENSITIVITY_DEFAULTS.slope,
    },
    median_risk_index: quantile(0.5),
    p10_risk_index: quantile(0.10),
    p90_risk_index: quantile(0.90),
    proportion_high_severe: Math.round((highSevere / scores.length) * 1000) / 1000,
    min_risk_index: scores[0],
    max_risk_index: scores[scores.length - 1],
    label: SENSITIVITY_LABEL,
    timestamp: new Date().toISOString(),
  };
}
