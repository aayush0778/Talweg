import React, { useEffect } from 'react';
import { HazardProgressionResponse } from '../types/api';
import { getRiskBadgeClasses } from '../lib/riskColors';

interface HazardProgressionPlayerProps {
  data: HazardProgressionResponse;
  currentStepIndex: number;
  onStepChange: (step: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onClose: () => void;
  showCorridor: boolean;
  onToggleCorridor: () => void;
  showHistoricalMarker: boolean;
  onToggleHistoricalMarker: () => void;
  terrain3D: boolean;
  onToggleTerrain3D: () => void;
}

export const HazardProgressionPlayer: React.FC<HazardProgressionPlayerProps> = ({
  data,
  currentStepIndex,
  onStepChange,
  isPlaying,
  onTogglePlay,
  onClose,
  showCorridor,
  onToggleCorridor,
  showHistoricalMarker,
  onToggleHistoricalMarker,
  terrain3D,
  onToggleTerrain3D,
}) => {
  const currentStep = data.timeline[currentStepIndex] || data.timeline[0];

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setInterval(() => {
      onStepChange((prev) => {
        if (prev < data.timeline.length - 1) {
          return prev + 1;
        } else {
          return 0; // loop
        }
      });
    }, 2800);

    return () => clearInterval(timer);
  }, [isPlaying, data.timeline.length, onStepChange]);

  const badgeClasses = getRiskBadgeClasses(currentStep.risk_level);

  return (
    <div className="absolute bottom-6 left-6 right-6 md:left-12 md:right-[440px] z-20 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto text-slate-100 flex flex-col transition-all duration-300">
      {/* Top Bar: Title, Scientific Disclaimer Badge, and Close Button */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-950/80 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="text-base">🌊</span>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-2">
              <span>TALWEG Predictive Runout Replay</span>
              <span className="text-[10px] text-slate-400 font-normal">({data.event_date})</span>
            </h3>
            <p className="text-[11px] text-slate-400 truncate max-w-md">{data.event_name}</p>
          </div>
        </div>

        {/* Mandatory Scientific Honesty Badge */}
        <div className="hidden lg:flex flex-col items-center px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-md">
          <span className="text-[10px] font-bold text-amber-400 tracking-wide uppercase">
            Illustrative Terrain-Based Movement Simulation
          </span>
          <span className="text-[9px] text-amber-300/70">
            Not a physical landslide trajectory forecast
          </span>
        </div>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded transition cursor-pointer"
          title="Exit Progression Replay"
        >
          ✕
        </button>
      </div>

      {/* Main Player Body: Stepper, Telemetry Gauges, Narrative */}
      <div className="p-4 space-y-3.5">
        {/* Timeline Stepper Nodes */}
        <div className="relative flex items-center justify-between px-2">
          {/* Background Connecting Line */}
          <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-800 rounded-full" />
          {/* Active Fill Line */}
          <div
            className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-blue-500 transition-all duration-500 rounded-full"
            style={{
              width: `calc(${(currentStepIndex / (data.timeline.length - 1)) * 100}% - 24px)`,
            }}
          />

          {data.timeline.map((step, idx) => {
            const isCurrent = idx === currentStepIndex;
            const isPassed = idx <= currentStepIndex;
            return (
              <button
                key={step.phase}
                onClick={() => onStepChange(idx)}
                className={`relative z-10 flex flex-col items-center group cursor-pointer transition-transform ${
                  isCurrent ? 'scale-110' : 'hover:scale-105'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
                    isCurrent
                      ? 'bg-blue-600 border-white text-white shadow-lg shadow-blue-500/50 ring-2 ring-blue-400/40'
                      : isPassed
                      ? 'bg-slate-800 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                >
                  {step.phase === 'EVENT' ? '⚡' : `${idx + 1}`}
                </div>
                <span
                  className={`text-[10px] font-semibold mt-1 transition-colors ${
                    isCurrent ? 'text-white font-bold' : isPassed ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {step.phase}
                </span>
              </button>
            );
          })}
        </div>

        {/* Telemetry Readouts & Stage Narrative */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* 1. Rainfall Readout */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              24h Rainfall
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-cyan-300">
                {currentStep.rainfall_24h.toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">mm</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5">3d: {currentStep.rainfall_3d.toFixed(0)} mm</span>
          </div>

          {/* 2. Soil Saturation */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Soil Saturation
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-blue-300">
                {(currentStep.soil_moisture * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className="bg-blue-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${currentStep.soil_moisture * 100}%` }}
              />
            </div>
          </div>

          {/* 3. TALWEG Risk Score */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                Risk Score
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}
              >
                {currentStep.risk_level}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={`text-xl font-extrabold font-mono ${badgeClasses.text}`}>
                {currentStep.risk_score.toFixed(2)}
              </span>
              {currentStep.threshold_crossed && (
                <span className="text-[9px] font-bold text-red-400 uppercase animate-pulse">
                  Alert Active
                </span>
              )}
            </div>
            <span className="text-[9px] text-slate-400">Threshold: 0.56</span>
          </div>

          {/* 4. Descent Progress */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              Runout Progress
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-xl font-bold font-mono text-amber-300">
                {(currentStep.flow_progress * 100).toFixed(0)}%
              </span>
            </div>
            <span className="text-[10px] text-slate-400 truncate">
              {currentStep.flow_progress === 0
                ? 'Slope Stable'
                : currentStep.flow_progress === 1
                ? 'Deposition Reached'
                : 'Channelizing Gorge'}
            </span>
          </div>
        </div>

        {/* Narrative Banner */}
        <div
          className={`p-3 rounded-xl border transition-all ${
            currentStep.threshold_crossed
              ? 'bg-amber-950/30 border-amber-800/60'
              : 'bg-slate-950/50 border-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-xs">{currentStep.threshold_crossed ? '🚨' : 'ℹ️'}</span>
            <span className="text-xs font-bold text-white tracking-wide">
              {currentStep.stage_title}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            {currentStep.stage_description}
          </p>
        </div>

        {/* Bottom Controls: Play/Pause, Step Buttons, and Layer Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
          {/* Playback Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={onTogglePlay}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-md'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
              }`}
            >
              <span>{isPlaying ? '⏸' : '▶'}</span>
              <span>{isPlaying ? 'Pause' : 'Play Simulation'}</span>
            </button>

            <button
              onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer"
              title="Previous Step"
            >
              ◀ Step
            </button>

            <button
              onClick={() => onStepChange(Math.min(data.timeline.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === data.timeline.length - 1}
              className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer"
              title="Next Step"
            >
              Step ▶
            </button>

            <button
              onClick={() => onStepChange(0)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
              title="Reset to T-72h"
            >
              Reset
            </button>
          </div>

          {/* Layer Toggles */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={onToggleCorridor}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                showCorridor
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <span>{showCorridor ? '✓' : '○'}</span>
              <span>Predicted Corridor</span>
            </button>

            <button
              onClick={onToggleHistoricalMarker}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                showHistoricalMarker
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <span>{showHistoricalMarker ? '✓' : '○'}</span>
              <span>Actual GLC Event</span>
            </button>

            <button
              onClick={onToggleTerrain3D}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer flex items-center gap-1.5 ${
                terrain3D
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <span>🏔️</span>
              <span>{terrain3D ? '3D Active' : '3D View'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
