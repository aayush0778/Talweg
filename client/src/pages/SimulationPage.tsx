import React, { useState } from 'react';
import { useApiResource } from '../hooks/useApiResource';
import {
  fetchRiskZones,
  fetchScenarioPresets,
  runSimulation,
  runSensitivity,
} from '../lib/apiClient';
import {
  PageShell,
  LoadingBlock,
  ErrorBlock,
  RiskIndex,
} from '../components/page/PageShell';
import { RiskBadge } from '../components/RiskBadge';
import {
  RiskZone,
  ScenarioPresetId,
  ScenarioPresetInfo,
  SimulationResponse,
  SensitivityResponse,
  SimulationOverrides,
} from '../types/api';
import { Play, BarChart3, RotateCcw, Info } from 'lucide-react';

/**
 * Scenario Simulation page (Final Upgrade Spec §17)
 *
 * Modifies actual model inputs and recomputes risk through the hybrid
 * composer. Shows baseline vs scenario, delta, threshold response and the
 * largest-change driver. Sensitivity mode is explicitly labeled
 * "Scenario sensitivity, not statistical prediction uncertainty."
 */

const SimulationPage: React.FC = () => {
  const zonesQ = useApiResource(fetchRiskZones, []);
  const presetsQ = useApiResource(fetchScenarioPresets, []);
  const [zoneId, setZoneId] = useState<string>('');
  const [overrides, setOverrides] = useState<SimulationOverrides>({});
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [sensitivity, setSensitivity] = useState<SensitivityResponse | null>(null);
  const [sensLoading, setSensLoading] = useState(false);
  const [sensError, setSensError] = useState<string | null>(null);

  const zones: RiskZone[] = zonesQ.data ?? [];
  const presets: ScenarioPresetInfo[] = presetsQ.data?.presets ?? [];
  const effectiveZoneId = zoneId || zones[0]?.id || '';

  const zone = zones.find((z) => z.id === effectiveZoneId) ?? null;

  const applyPreset = (presetId: string) => {
    if (!effectiveZoneId) return;
    setSimLoading(true);
    setSimError(null);
    setSensitivity(null);
    runSimulation({
      zone_id: effectiveZoneId,
      preset: presetId as ScenarioPresetId,
      overrides: presetId === 'custom' ? overrides : undefined,
    })
      .then((res) => {
        setSimulation(res);
        if (res.baseline && presetId !== 'custom') {
          // reflect what the preset actually changed into the sliders
          setOverrides(extractOverrides(res));
        }
      })
      .catch((err) => setSimError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSimLoading(false));
  };

  const runCustom = () => {
    if (!effectiveZoneId) return;
    setSimLoading(true);
    setSimError(null);
    setSensitivity(null);
    runSimulation({ zone_id: effectiveZoneId, preset: 'custom', overrides })
      .then(setSimulation)
      .catch((err) => setSimError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSimLoading(false));
  };

  const runSensitivityMode = () => {
    if (!effectiveZoneId) return;
    setSensLoading(true);
    setSensError(null);
    runSensitivity(effectiveZoneId, 40, 42)
      .then(setSensitivity)
      .catch((err) => setSensError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSensLoading(false));
  };

  const reset = () => {
    setOverrides({});
    setSimulation(null);
    setSensitivity(null);
    setSimError(null);
    setSensError(null);
  };

  return (
    <PageShell
      title="Scenario Simulation"
      description="What-if analysis on real model inputs: every scenario recomputes risk through the full hybrid pipeline (surrogate model + rainfall threshold safety floor)."
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Controls */}
        <section className="xl:col-span-1 space-y-4" aria-label="Scenario controls">
          <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Zone</span>
              <select
                value={effectiveZoneId}
                onChange={(e) => {
                  setZoneId(e.target.value);
                  reset();
                }}
                className="w-full bg-ink-800 border border-line-strong rounded-sm px-2.5 py-2 text-sm text-paper-100"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </label>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Scenario presets</span>
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.description}
                    onClick={() => applyPreset(p.id)}
                    disabled={simLoading || !effectiveZoneId || p.id === 'custom'}
                    className="px-2 py-2 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 hover:bg-ink-700 disabled:opacity-40 text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <SliderField
              label="Rainfall 24h (mm)"
              value={overrides.rainfall_24h}
              baselineValue={simulation?.baseline.rainfall_threshold.evaluation.durations.find((d) => d.duration_days === 1)?.observed_cumulative_mm ?? null}
              min={0} max={200} step={1}
              onChange={(v) => setOverrides((o) => ({ ...o, rainfall_24h: v }))}
            />
            <SliderField
              label="Rainfall 3d (mm)"
              value={overrides.rainfall_3d}
              baselineValue={simulation?.baseline.rainfall_threshold.evaluation.durations.find((d) => d.duration_days === 3)?.observed_cumulative_mm ?? null}
              min={0} max={500} step={1}
              onChange={(v) => setOverrides((o) => ({ ...o, rainfall_3d: v }))}
            />
            <SliderField
              label="Soil moisture (0–1)"
              value={overrides.soil_moisture}
              min={0} max={1} step={0.01}
              onChange={(v) => setOverrides((o) => ({ ...o, soil_moisture: v }))}
            />
            <SliderField
              label="Slope (°)"
              value={overrides.slope}
              min={0} max={60} step={0.5}
              onChange={(v) => setOverrides((o) => ({ ...o, slope: v }))}
            />
            <SliderField
              label="Historical density (events)"
              value={overrides.historical_density}
              min={0} max={10} step={1}
              onChange={(v) => setOverrides((o) => ({ ...o, historical_density: v }))}
            />

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={runCustom}
                disabled={simLoading || !effectiveZoneId}
                className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-[11px] font-mono uppercase tracking-wider bg-[#789b35] text-ink-950 font-semibold hover:bg-[#8db03f] disabled:opacity-40"
              >
                <Play size={13} /> Run custom
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-[11px] font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 hover:bg-ink-700"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </div>
          </div>

          {/* Sensitivity */}
          <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-mono uppercase tracking-[0.12em] text-paper-300">Sensitivity (N=40)</h2>
              <button
                type="button"
                onClick={runSensitivityMode}
                disabled={sensLoading || !effectiveZoneId}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 hover:bg-ink-700 disabled:opacity-40"
              >
                <BarChart3 size={12} /> Run
              </button>
            </div>
            <p className="text-[10px] font-mono text-paper-400 leading-relaxed">
              Controlled perturbations: rainfall ±10% · soil moisture ±10% · slope ±5%.
              <span className="block text-[#d8c56a] pt-1">Scenario sensitivity, not statistical prediction uncertainty.</span>
            </p>
            {sensError && <ErrorBlock message={sensError} />}
            {sensLoading && <LoadingBlock label="Running 40 perturbed scenarios…" />}
            {sensitivity && (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <Metric label="Median" value={fmt100(sensitivity.median_risk_index)} />
                <Metric label="P10" value={fmt100(sensitivity.p10_risk_index)} />
                <Metric label="P90" value={fmt100(sensitivity.p90_risk_index)} />
                <Metric label="≥ HIGH/SEVERE" value={`${Math.round(sensitivity.proportion_high_severe * 100)}%`} />
              </dl>
            )}
          </div>
        </section>

        {/* Results */}
        <section className="xl:col-span-2 space-y-4" aria-label="Scenario results" aria-live="polite">
          {simError && <ErrorBlock message={simError} />}
          {!simulation && !simLoading && (
            <div className="bg-ink-900 border border-dashed border-line-strong rounded-md p-10 text-center">
              <p className="text-xs font-mono text-paper-400">
                Select a preset or move the sliders, then run a scenario.
                {zone && ` Current risk for ${zone.name}: ${zone.risk_level ?? '—'}.`}
              </p>
            </div>
          )}
          {simLoading && <LoadingBlock label="Recomputing risk through the hybrid pipeline…" />}
          {simulation && !simLoading && (
            <SimulationResultCard simulation={simulation} />
          )}
        </section>
      </div>
    </PageShell>
  );
};

const SimulationResultCard: React.FC<{ simulation: SimulationResponse }> = ({ simulation }) => {
  const { baseline, scenario, delta, largest_change_driver } = simulation;
  const levelChanged = delta.risk_level_from !== delta.risk_level_to;

  return (
    <div className="space-y-4">
      {/* Baseline vs scenario (spec §17.3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Baseline</p>
          <div className="flex items-baseline gap-2">
            <RiskIndex score={baseline.risk_index} size="lg" />
            <RiskBadge level={baseline.risk_level} showDot={false} />
          </div>
          <p className="text-[10px] font-mono text-paper-400">
            threshold {baseline.rainfall_threshold.ratio !== null ? `${baseline.rainfall_threshold.ratio.toFixed(2)}×` : '—'}
          </p>
        </div>

        <div className="bg-ink-900 border border-[#789b35]/40 rounded-md p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Scenario</p>
          <div className="flex items-baseline gap-2">
            <RiskIndex score={scenario.risk_index} size="lg" />
            <RiskBadge level={scenario.risk_level} showDot={false} />
          </div>
          <p className="text-[10px] font-mono text-paper-400">
            threshold {scenario.rainfall_threshold.ratio !== null ? `${scenario.rainfall_threshold.ratio.toFixed(2)}×` : '—'}
          </p>
        </div>

        <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Δ Risk</p>
          <p className={`text-3xl font-bold font-mono tabular-nums ${delta.risk_index > 0 ? 'text-[#e49a62]' : delta.risk_index < 0 ? 'text-[#79c8a5]' : 'text-paper-100'}`}>
            {delta.risk_index > 0 ? '+' : ''}{Math.round(delta.risk_index * 100)} pts
          </p>
          <p className="text-[10px] font-mono text-paper-400">
            {delta.risk_level_from} → <span className={levelChanged ? 'text-paper-100' : ''}>{delta.risk_level_to}</span>
            {delta.threshold_ratio_change !== null && (
              <> · Δ threshold {delta.threshold_ratio_change >= 0 ? '+' : ''}{delta.threshold_ratio_change.toFixed(2)}×</>
            )}
          </p>
        </div>
      </div>

      {/* Largest driver + rules (spec §24: deterministic signals, not model attribution) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Largest change driver</p>
          {largest_change_driver ? (
            <p className="text-sm text-paper-100">
              <span className="font-semibold">{largest_change_driver.feature}</span>{' '}
              {largest_change_driver.baseline_value} → {largest_change_driver.scenario_value}{' '}
              <span className="text-paper-400 font-mono text-xs">
                (Δ {largest_change_driver.delta > 0 ? '+' : ''}{largest_change_driver.delta})
              </span>
            </p>
          ) : (
            <p className="text-sm text-paper-400">No input changed.</p>
          )}
          <p className="text-[10px] font-mono text-[#d8c56a] flex items-start gap-1.5 pt-1">
            <Info size={12} className="shrink-0 mt-0.5" />
            {simulation.label}
          </p>
        </div>

        <div className="bg-ink-900 border border-line-subtle rounded-md p-4 space-y-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">Deterministic rule signals</p>
          <ul className="space-y-1.5">
            {scenario.triggered_rules.map((r) => (
              <li key={r.rule} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-paper-200 truncate">{r.rule.replace(/_/g, ' ')}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-paper-400 truncate max-w-40">{r.detail}</span>
                  <RiskBadge level={r.status} showDot={false} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Threshold response table (spec: threshold response changes with rainfall) */}
      <div className="bg-ink-900 border border-line-subtle rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <caption className="sr-only">Rainfall threshold response by duration, baseline vs scenario</caption>
          <thead>
            <tr className="text-left text-[10px] font-mono uppercase tracking-wider text-paper-400 border-b border-line-subtle">
              <th scope="col" className="px-4 py-2.5">Duration</th>
              <th scope="col" className="px-4 py-2.5">Baseline rain (mm)</th>
              <th scope="col" className="px-4 py-2.5">Scenario rain (mm)</th>
              <th scope="col" className="px-4 py-2.5">Threshold (mm)</th>
              <th scope="col" className="px-4 py-2.5">Ratio</th>
              <th scope="col" className="px-4 py-2.5">Band</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {scenario.rainfall_threshold.evaluation.durations.map((d, i) => {
              const b = baseline.rainfall_threshold.evaluation.durations[i];
              return (
                <tr key={d.duration_days}>
                  <td className="px-4 py-2 text-paper-100">{d.duration_days}d</td>
                  <td className="px-4 py-2 text-paper-300 tabular-nums">{b?.evaluated ? b.observed_cumulative_mm : '—'}</td>
                  <td className="px-4 py-2 text-paper-300 tabular-nums">{d.evaluated ? d.observed_cumulative_mm : '—'}</td>
                  <td className="px-4 py-2 text-paper-300 tabular-nums">{d.threshold_cumulative_mm}</td>
                  <td className={`px-4 py-2 tabular-nums ${d.ratio >= 1 ? 'text-[#e49a62] font-semibold' : 'text-paper-300'}`}>
                    {d.evaluated ? `${d.ratio.toFixed(2)}×` : '—'}
                  </td>
                  <td className="px-4 py-2 text-paper-300">{d.evaluated ? d.band : 'n/a'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2.5 text-[10px] font-mono text-paper-400 border-t border-line-subtle">
          {scenario.rainfall_threshold.evaluation.citation} · rainfall provenance: {scenario.rainfall_threshold.evaluation.rainfall_provenance}
        </p>
      </div>
    </div>
  );
};

function extractOverrides(res: SimulationResponse): SimulationOverrides {
  // The preset response carries the scenario composition; map its threshold
  // evaluation back to editable rainfall values so sliders reflect the preset.
  const durations = res.scenario.rainfall_threshold.evaluation.durations;
  const overrides: SimulationOverrides = {};
  const byDuration = (d: number) => durations.find((x) => x.duration_days === d);
  const d1 = byDuration(1);
  const d3 = byDuration(3);
  const d5 = byDuration(5);
  const d7 = byDuration(7);
  if (d1?.evaluated) overrides.rainfall_24h = d1.observed_cumulative_mm;
  if (d3?.evaluated) overrides.rainfall_3d = d3.observed_cumulative_mm;
  if (d5?.evaluated) overrides.rainfall_5d = d5.observed_cumulative_mm;
  if (d7?.evaluated) overrides.rainfall_7d = d7.observed_cumulative_mm;
  return overrides;
}

const SliderField: React.FC<{
  label: string;
  value: number | undefined;
  baselineValue?: number | null;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}> = ({ label, value, baselineValue, min, max, step, onChange }) => (
  <label className="block space-y-1">
    <span className="flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">
      <span>{label}</span>
      <span className="text-paper-200 tabular-nums">{value !== undefined ? value : baselineValue != null ? `baseline ${baselineValue}` : '—'}</span>
    </span>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value ?? baselineValue ?? min}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full accent-[#789b35]"
    />
  </label>
);

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="bg-ink-800 border border-line-subtle rounded-sm px-2.5 py-2">
    <dt className="text-[9px] font-mono uppercase tracking-wider text-paper-400">{label}</dt>
    <dd className="text-sm font-mono tabular-nums text-paper-100">{value}</dd>
  </div>
);

function fmt100(score: number): string {
  return String(Math.round(score * 100));
}

export default SimulationPage;
