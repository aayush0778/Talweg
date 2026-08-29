import React from 'react';
import { EnvironmentObservation } from '../types/api';
import { ScenarioValues } from '../lib/scenario';

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
      <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs text-slate-400 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold uppercase tracking-wider text-slate-300">
            Rainfall Scenario Simulator
          </span>
        </div>
        <p className="text-slate-500 italic">
          Telemetry incomplete — scenario simulation unavailable for this zone.
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
    const val = Number(e.target.value) / 100; // Convert 0-100% to 0.0-1.0
    setValues((prev) => (prev ? { ...prev, soil_moisture: Number(val.toFixed(2)) } : null));
  };

  const soilPct = Math.round(values.soil_moisture * 100);
  const baselineSoilPct =
    environment.soil_moisture !== null ? Math.round(environment.soil_moisture * 100) : 0;

  return (
    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-lg space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Rainfall Scenario Simulator
            </h3>
            {simLoading && (
              <span className="flex items-center gap-1 text-[10px] text-amber-400 animate-pulse font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Updating…
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Simulate monsoon conditions. Score updates live.
          </p>
        </div>

        {isModified && (
          <span className="px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-400 border border-amber-800/80 text-[10px] font-bold tracking-wider uppercase shadow-sm">
            Scenario
          </span>
        )}
      </div>

      {/* Sliders Container */}
      <div className="space-y-3 pt-1">
        {/* 24h Rainfall Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-rain-24h" className="text-slate-300">
              24h Rainfall
            </label>
            <span className="text-white font-mono font-semibold">
              {values.rainfall_24h}{' '}
              <span className="text-slate-400 font-normal text-[11px]">mm</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 mm</span>
            <span>200 mm</span>
          </div>
        </div>

        {/* 3-Day Cumulative Rainfall Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-rain-3d" className="text-slate-300">
              3-Day Cumulative
            </label>
            <span className="text-white font-mono font-semibold">
              {values.rainfall_3d}{' '}
              <span className="text-slate-400 font-normal text-[11px]">mm</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 mm</span>
            <span>500 mm</span>
          </div>
        </div>

        {/* Soil Saturation Slider */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs font-medium">
            <label htmlFor="sim-soil" className="text-slate-300">
              Soil Saturation
            </label>
            <span className="text-white font-mono font-semibold">
              {soilPct}{' '}
              <span className="text-slate-400 font-normal text-[11px]">%</span>
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 focus:outline-none"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0 %</span>
            <span>100 %</span>
          </div>
        </div>
      </div>

      {/* Inline Error Notice */}
      {simError && (
        <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/80 text-[11px] text-rose-300 flex items-center justify-between">
          <span>Simulation unavailable — showing last result</span>
        </div>
      )}

      {/* Baseline Info & Reset Button */}
      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
        <div className="text-[11px] text-slate-400 font-mono">
          Baseline: {environment.rainfall_24h ?? '—'} · {environment.rainfall_3d ?? '—'} ·{' '}
          {baselineSoilPct}%
        </div>

        <button
          onClick={onReset}
          disabled={!isModified}
          className={`px-2.5 py-1 text-xs font-medium rounded-lg border transition cursor-pointer ${
            isModified
              ? 'bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 border-slate-700'
              : 'bg-slate-900 text-slate-600 border-slate-800/60 cursor-not-allowed opacity-60'
          }`}
        >
          Reset to observed
        </button>
      </div>

      {/* Machine / Simulation Transparency Footer */}
      <div className="text-[10px] text-slate-500 pt-0.5 flex items-center gap-1">
        <span>ⓘ</span>
        <span>Scenario values are hypothetical — not measurements.</span>
      </div>
    </div>
  );
};
