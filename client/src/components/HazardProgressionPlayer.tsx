import React, { useEffect, useState, useRef } from 'react';
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

  // Vertical adjustability state
  const [isCompact, setIsCompact] = useState(false);
  const [customHeight, setCustomHeight] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const startHeightRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // Drag-to-resize handlers (Mouse & Touch)
  const handleDragStart = (clientY: number) => {
    setIsDragging(true);
    dragStartYRef.current = clientY;
    const currentHeight = containerRef.current?.getBoundingClientRect().height || 380;
    startHeightRef.current = currentHeight;
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = dragStartYRef.current - e.clientY;
      const proposedHeight = startHeightRef.current + delta;
      const minH = 68;
      const maxH = Math.min(window.innerHeight * 0.85, 620);
      const clamped = Math.max(minH, Math.min(maxH, proposedHeight));

      if (clamped <= 140) {
        setIsCompact(true);
        setCustomHeight(minH);
      } else {
        setIsCompact(false);
        setCustomHeight(clamped);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const delta = dragStartYRef.current - e.touches[0].clientY;
      const proposedHeight = startHeightRef.current + delta;
      const minH = 68;
      const maxH = Math.min(window.innerHeight * 0.85, 620);
      const clamped = Math.max(minH, Math.min(maxH, proposedHeight));

      if (clamped <= 140) {
        setIsCompact(true);
        setCustomHeight(minH);
      } else {
        setIsCompact(false);
        setCustomHeight(clamped);
      }
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  const toggleCompact = () => {
    if (isCompact) {
      setIsCompact(false);
      setCustomHeight(null);
    } else {
      setIsCompact(true);
      setCustomHeight(68);
    }
  };

  const badgeClasses = getRiskBadgeClasses(currentStep.risk_level);

  return (
    <div
      ref={containerRef}
      style={{
        height: customHeight ? `${customHeight}px` : undefined,
        maxHeight: isCompact ? '68px' : 'calc(100vh - 100px)',
      }}
      className={`absolute bottom-4 left-4 right-4 md:left-10 md:right-[440px] z-20 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden pointer-events-auto text-slate-100 flex flex-col ${
        isDragging ? 'select-none transition-none' : 'transition-all duration-300'
      }`}
    >
      {/* 1. Top Vertical Resize Handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          handleDragStart(e.clientY);
        }}
        onTouchStart={(e) => {
          if (e.touches.length === 1) handleDragStart(e.touches[0].clientY);
        }}
        onDoubleClick={toggleCompact}
        className="w-full h-3 flex items-center justify-center cursor-ns-resize group bg-slate-950/90 hover:bg-blue-600/30 transition-colors border-b border-slate-800/80 select-none shrink-0"
        title="Drag vertically to adjust height • Double-click to toggle Compact View"
      >
        <div className="w-12 h-1 rounded-full bg-slate-600 group-hover:bg-blue-400 group-hover:w-20 transition-all shadow-sm" />
      </div>

      {isCompact ? (
        /* COMPACT MODE: Ultra-sleek single-strip toolbar (~56px) allowing full map visibility */
        <div className="flex items-center justify-between px-3 py-2 bg-slate-950/90 gap-2 h-full">
          {/* Left: Play/Pause, Step Controls, Phase Label */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onTogglePlay}
              className={`flex items-center justify-center w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 ${
                isPlaying
                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <button
              onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer shrink-0"
              title="Previous Step"
            >
              ◀
            </button>

            <button
              onClick={() => onStepChange(Math.min(data.timeline.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === data.timeline.length - 1}
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition cursor-pointer shrink-0"
              title="Next Step"
            >
              ▶
            </button>

            {/* Stepper Dots */}
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              {data.timeline.map((step, idx) => (
                <button
                  key={step.phase}
                  onClick={() => onStepChange(idx)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'bg-blue-600 border-white text-white shadow'
                      : idx < currentStepIndex
                      ? 'bg-slate-800 border-blue-500 text-blue-300'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}
                  title={`${step.phase}: ${step.stage_title}`}
                >
                  {step.phase === 'EVENT' ? '⚡' : `${idx + 1}`}
                </button>
              ))}
            </div>

            {/* Current Phase & Telemetry Summary */}
            <div className="flex items-center gap-1.5 text-xs truncate ml-1">
              <span className="font-bold text-white tracking-wide shrink-0">
                {currentStep.phase}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}
              >
                {currentStep.risk_score.toFixed(2)} {currentStep.risk_level}
              </span>
              <span className="hidden lg:inline text-[11px] text-amber-300 font-mono shrink-0">
                Runout: {(currentStep.flow_progress * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Right: Layer Toggles, Expand Button, Close */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleCorridor}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition cursor-pointer hidden md:flex items-center gap-1 ${
                showCorridor
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
              title="Toggle Predicted Corridor Layer"
            >
              <span>{showCorridor ? '✓' : '○'}</span>
              <span>Corridor</span>
            </button>

            <button
              onClick={onToggleTerrain3D}
              className={`px-2 py-1 rounded text-[10px] font-medium border transition cursor-pointer hidden sm:flex items-center gap-1 ${
                terrain3D
                  ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
              title="Toggle 3D Relief Terrain"
            >
              <span>🏔️</span>
              <span>{terrain3D ? '3D' : '2D'}</span>
            </button>

            {/* Expand Full Dashboard Button */}
            <button
              onClick={toggleCompact}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/40 transition-all cursor-pointer shadow-sm"
              title="Expand full telemetry dashboard"
            >
              <span>▲</span>
              <span>Expand</span>
            </button>

            {/* Exit Close Button */}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Exit Simulation"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED FULL DASHBOARD MODE */
        <>
          {/* Top Bar: Title, Provenance Mode Badge, Disclaimer, Vertical Control & Close */}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-base">🌊</span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    {data.simulation_mode === 'historical_replay'
                      ? 'Historical Ground-Truth Replay'
                      : 'TALWEG Predictive Runout Simulation'}
                  </h3>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                      data.simulation_mode === 'historical_replay'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                    }`}
                  >
                    {data.simulation_mode === 'historical_replay'
                      ? 'HISTORICAL GROUND-TRUTH REPLAY'
                      : 'PREDICTIVE RUNOUT (CURRENT TELEMETRY)'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate max-w-md">
                  {data.event_name} • <span className="text-slate-300 font-medium">{data.zone_name}</span>
                </p>
              </div>
            </div>

            {/* Scientific Disclaimer */}
            <div className="hidden xl:flex flex-col items-center px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-md">
              <span className="text-[10px] font-bold text-amber-400 tracking-wide uppercase">
                Illustrative Terrain-Based Movement Simulation
              </span>
              <span className="text-[9px] text-amber-300/70">
                Not a physical landslide trajectory forecast
              </span>
            </div>

            {/* Top Right Actions: Compact Mode Toggle & Close */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleCompact}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer shadow-sm"
                title="Collapse to compact bottom bar to maximize visual map area"
              >
                <span>▼</span>
                <span>Compact</span>
              </button>

              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800 transition cursor-pointer"
                title="Exit Progression Replay"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Scrollable Dashboard Body */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
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
                  ? data.simulation_mode === 'historical_replay'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                    : 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400'
              }`}
            >
              <span>{showHistoricalMarker ? '✓' : '○'}</span>
              <span>
                {data.simulation_mode === 'historical_replay'
                  ? 'Actual Event Marker'
                  : 'Projected Deposition Fan'}
              </span>
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
    </>
  )}
</div>
);
};
