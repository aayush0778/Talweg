import React from 'react';
import { SlidersHorizontal, Info } from 'lucide-react';
import { EnvironmentObservation } from '../types/api';
import { ScenarioValues } from '../lib/scenario';
import { ProvenanceBadge } from './ProvenanceBadge';

interface ScenarioSimulatorProps {
  values: ScenarioValues | null;
  setValues: React.Dispatch<React.SetStateAction<ScenarioValues | null>>;
  environment: EnvironmentObservation | null;
  simLoading: boolean;
  simError: Error | null;
  isModified: boolean;
  available: boolean;
  onReset: () => void;
}

export const ScenarioSimulator: React.FC<ScenarioSimulatorProps> = ({
  values,
  setValues,
  environment,
  simLoading,
  simError,
  isModified,
  available,
  onReset,
}) => {
  if (!available || !values || !environment) {
    return (
      <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong text-xs text-paper-400 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold uppercase tracking-wider text-paper-300 flex items-center gap-2">
            What-if Scenario
            <ProvenanceBadge type="SIMULATED" note="What-if scenario analysis" />
          </span>
        </div>
        <p className="text-paper-400 italic">
          Telemetry incomplete — scenario simulation unavailable for this corridor.
        </p>
      </div>
    );
  }

  const handleRainfall24hChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setValues((prev) => (prev ? { ...prev, rainfall_24h: val } : null));
  };

  const handleRainfall3dChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setValues((prev) => (prev ? { ...prev, rainfall_3d: val } : null));
  };

  const handleSoilMoistureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) / 100;
    setValues((prev) => (prev ? { ...prev, soil_moisture: Number(val.toFixed(2)) } : null));
  };

  const soilPct = Math.round(values.soil_moisture * 100);
  const baselineSoilPct =
    environment.soil_moisture !== null ? Math.round(environment.soil_moisture * 100) : 0;

  return (
    <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong shadow-inner space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-lichen-400" aria-hidden="true" />
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-200 flex items-center gap-2">
              What-if Scenario
              <ProvenanceBadge type="SIMULATED" note="What-if scenario analysis" />
            </h3>
            {simLoading && (
              <span className="flex items-center gap-1 text-[10px] text-silt-300 animate-pulse font-mono font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-silt-400 animate-ping" />
                Recalculating…
              </span>
            )}
          </div>
          <p className="text-[11px] text-paper-400 mt-0.5">
            Scenario analysis — not a recorded forecast.
          </p>
        </div>

        {isModified && (
          <span className="px-2 py-0.5 rounded bg-silt-900/60 text-silt-300 border border-silt-700 text-[10px] font-mono font-bold tracking-wider uppercase">
            Scenario
          </span>
        )}
      </div>

      {/* Sliders Container */}
      <div className="space-y-3 pt-1">
        {/* 24h Rainfall Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-rain-24h" className="text-paper-300">
              24h Rainfall
            </label>
            <span className="text-paper-50 font-mono font-semibold tabular-nums">
              {values.rainfall_24h}{' '}
              <span className="text-paper-400 font-normal text-[11px]">mm</span>
            </span>
          </div>
          <input
            id="sim-rain-24h"
            type="range"
            min={0}
            max={200}
            step={5}
            value={values.rainfall_24h}
            onChange={handleRainfall24hChange}
            className="w-full h-2 bg-ink-800 rounded-lg appearance-none cursor-pointer accent-lichen-500 hover:accent-lichen-400 focus:outline-none min-h-[44px] sm:min-h-0"
          />
          <div className="flex justify-between text-[10px] text-paper-400 font-mono">
            <span>0 mm</span>
            <span>200 mm</span>
          </div>
        </div>

        {/* 3-Day Cumulative Rainfall Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-rain-3d" className="text-paper-300">
              3-Day Cumulative
            </label>
            <span className="text-paper-50 font-mono font-semibold tabular-nums">
              {values.rainfall_3d}{' '}
              <span className="text-paper-400 font-normal text-[11px]">mm</span>
            </span>
          </div>
          <input
            id="sim-rain-3d"
            type="range"
            min={0}
            max={500}
            step={10}
            value={values.rainfall_3d}
            onChange={handleRainfall3dChange}
            className="w-full h-2 bg-ink-800 rounded-lg appearance-none cursor-pointer accent-lichen-500 hover:accent-lichen-400 focus:outline-none min-h-[44px] sm:min-h-0"
          />
          <div className="flex justify-between text-[10px] text-paper-400 font-mono">
            <span>0 mm</span>
            <span>500 mm</span>
          </div>
        </div>

        {/* Soil Saturation Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-soil" className="text-paper-300">
              Soil Saturation
            </label>
            <span className="text-paper-50 font-mono font-semibold tabular-nums">
              {soilPct}{' '}
              <span className="text-paper-400 font-normal text-[11px]">%</span>
            </span>
          </div>
          <input
            id="sim-soil"
            type="range"
            min={0}
            max={100}
            step={5}
            value={soilPct}
            onChange={handleSoilMoistureChange}
            className="w-full h-2 bg-ink-800 rounded-lg appearance-none cursor-pointer accent-lichen-500 hover:accent-lichen-400 focus:outline-none min-h-[44px] sm:min-h-0"
          />
          <div className="flex justify-between text-[10px] text-paper-400 font-mono">
            <span>0 %</span>
            <span>100 %</span>
          </div>
        </div>
      </div>

      {/* Inline Error Notice */}
      {simError && (
        <div className="p-2 rounded bg-risk-severe/10 border border-risk-severe/40 text-[11px] text-risk-severe flex items-center justify-between">
          <span>Simulation unavailable — showing baseline assessment</span>
        </div>
      )}

      {/* Baseline Info & Reset Button */}
      <div className="pt-2 border-t border-line-subtle flex items-center justify-between text-xs">
        <div className="text-[11px] text-paper-400 font-mono">
          Baseline: {environment.rainfall_24h ?? '—'} · {environment.rainfall_3d ?? '—'} ·{' '}
          {baselineSoilPct}%
        </div>

        <button
          onClick={onReset}
          disabled={!isModified}
          className={`px-2.5 py-1 text-xs font-mono font-medium rounded border transition cursor-pointer ${
            isModified
              ? 'bg-ink-800 hover:bg-ink-700 text-paper-100 border-line-strong'
              : 'bg-ink-950 text-paper-400 border-line-subtle cursor-not-allowed opacity-50'
          }`}
        >
          Reset to observed
        </button>
      </div>

      {/* Simulation Transparency Footer */}
      <div className="text-[10px] text-paper-400 pt-0.5 flex items-center gap-1.5">
        <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>Scenario values are hypothetical inputs for stress-testing.</span>
      </div>
    </div>
  );
};
