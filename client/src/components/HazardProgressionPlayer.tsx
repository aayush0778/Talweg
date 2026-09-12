import React, { useEffect, useState, useRef } from 'react';
import {
  Play,
  Pause,
  ChevronUp,
  ChevronDown,
  X,
  Activity,
  Mountain,
  Check,
  Circle,
  Zap,
} from 'lucide-react';
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
  /** Width (px) of the zone sidebar to keep clear — the player floats over the map only. */
  rightInset?: number;
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
  rightInset,
}) => {
  const currentStep = data.timeline[currentStepIndex] || data.timeline[0];

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
          return 0;
        }
      });
    }, 2800);

    return () => clearInterval(timer);
  }, [isPlaying, data.timeline.length, onStepChange]);

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
      const minH = 64;
      const maxH = Math.min(window.innerHeight * 0.6, 440);
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

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const toggleCompact = () => {
    if (isCompact) {
      setIsCompact(false);
      setCustomHeight(320);
    } else {
      setIsCompact(true);
      setCustomHeight(64);
    }
  };

  const badgeClasses = getRiskBadgeClasses(currentStep.risk_level);

  // Float over the map area only — never covering the zone sidebar.
  const insetStyle: React.CSSProperties = {
    right: rightInset !== undefined ? rightInset + 24 : 12,
    ...(customHeight ? { height: `${customHeight}px` } : {}),
  };

  return (
    <aside
      ref={containerRef}
      style={insetStyle}
      className={`fixed bottom-3 left-3 z-30 bg-ink-900/98 backdrop-blur-xl border border-line-strong rounded-2xl shadow-drawer flex flex-col transition-all duration-150 select-none overflow-hidden ${
        isCompact ? 'h-[64px]' : customHeight ? '' : 'h-[300px] md:h-[320px]'
      }`}
      aria-label="Hazard progression player"
    >
      {/* Drag Bar */}
      <div
        onMouseDown={(e) => handleDragStart(e.clientY)}
        className="w-full py-1.5 flex items-center justify-center cursor-row-resize hover:bg-ink-800/50 transition-colors shrink-0 group"
        title="Drag up or down to resize player"
      >
        <div className="w-12 h-1 bg-ink-700 rounded-full group-hover:bg-lichen-400 transition-colors" />
      </div>

      {isCompact ? (
        /* COMPACT BAR MODE */
        <div className="flex items-center justify-between px-4 h-full">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-md bg-lichen-500 text-ink-950 flex items-center justify-center font-bold hover:bg-lichen-400 transition cursor-pointer shrink-0"
              title={isPlaying ? 'Pause simulation' : 'Play simulation'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            {/* Stepper Dots */}
            <div className="hidden sm:flex items-center gap-1.5 ml-1">
              {data.timeline.map((step, idx) => (
                <button
                  key={step.phase}
                  onClick={() => onStepChange(idx)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-mono font-bold border transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'bg-lichen-500 border-paper-50 text-ink-950 shadow'
                      : idx < currentStepIndex
                      ? 'bg-ink-800 border-lichen-600 text-lichen-300'
                      : 'bg-ink-950 border-line-subtle text-paper-400'
                  }`}
                  title={`${step.phase}: ${step.stage_title}`}
                >
                  {step.phase === 'EVENT' ? <Zap className="w-2.5 h-2.5" /> : `${idx + 1}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs truncate ml-1 font-mono">
              <span className="font-bold text-paper-50 tracking-wide shrink-0">
                {currentStep.phase}
              </span>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border shrink-0 ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}
              >
                {currentStep.risk_score.toFixed(2)} {currentStep.risk_level}
              </span>
              <span className="hidden lg:inline text-[11px] text-lichen-400 shrink-0">
                Runout: {(currentStep.flow_progress * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggleCorridor}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium border transition cursor-pointer hidden md:flex items-center gap-1 ${
                showCorridor
                  ? 'bg-lichen-700/20 border-lichen-500/50 text-lichen-300'
                  : 'bg-ink-950 border-line-subtle text-paper-400'
              }`}
              title="Toggle Predicted Corridor Layer"
            >
              {showCorridor ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              <span>Corridor</span>
            </button>

            <button
              onClick={onToggleHistoricalMarker}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium border transition cursor-pointer hidden md:flex items-center gap-1 ${
                showHistoricalMarker
                  ? 'bg-lichen-700/20 border-lichen-500/50 text-lichen-300'
                  : 'bg-ink-950 border-line-subtle text-paper-400'
              }`}
              title="Toggle Historical Event Target Marker"
            >
              {showHistoricalMarker ? <Check className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
              <span>Marker</span>
            </button>

            <button
              onClick={onToggleTerrain3D}
              className={`px-2 py-1 rounded text-[10px] font-mono font-medium border transition cursor-pointer hidden sm:flex items-center gap-1 ${
                terrain3D
                  ? 'bg-lichen-700/20 border-lichen-500/50 text-lichen-300'
                  : 'bg-ink-950 border-line-subtle text-paper-400'
              }`}
              title="Toggle 3D Relief Terrain"
            >
              <Mountain className="w-3 h-3" />
              <span>{terrain3D ? '3D' : '2D'}</span>
            </button>

            <button
              onClick={toggleCompact}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-ink-800 hover:bg-ink-700 text-paper-200 hover:text-paper-50 border border-line-strong transition cursor-pointer"
              title="Expand full telemetry dashboard"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              <span>Expand</span>
            </button>

            <button
              onClick={onClose}
              className="text-paper-400 hover:text-paper-50 p-1 rounded hover:bg-ink-800 transition cursor-pointer"
              title="Exit Simulation"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* EXPANDED FULL DASHBOARD MODE */
        <>
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 py-2 bg-ink-950/80 border-b border-line-subtle shrink-0">
            <div className="flex items-center gap-2.5">
              <Activity className="w-4 h-4 text-lichen-400" aria-hidden="true" />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-paper-50">
                    {data.simulation_mode === 'historical_replay'
                      ? 'Historical Ground-Truth Replay'
                      : 'TALWEG Predictive Runout Simulation'}
                  </h3>
                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                      data.simulation_mode === 'historical_replay'
                        ? 'bg-monsoon-900/30 border-monsoon-700 text-monsoon-300'
                        : 'bg-lichen-700/20 border-lichen-600/40 text-lichen-300'
                    }`}
                  >
                    {data.simulation_mode === 'historical_replay'
                      ? 'HISTORICAL GROUND-TRUTH'
                      : 'PREDICTIVE RUNOUT'}
                  </span>
                </div>
                <p className="text-[11px] text-paper-400 truncate max-w-md">
                  {data.event_name} • <span className="text-paper-200 font-medium">{data.zone_name}</span>
                </p>
              </div>
            </div>

            {/* Scientific Disclaimer */}
            <div className="hidden xl:flex flex-col items-center px-2.5 py-0.5 bg-silt-900/30 border border-silt-700 rounded-md">
              <span className="text-[10px] font-mono font-bold text-silt-300 tracking-wide uppercase">
                Illustrative Movement Simulation
              </span>
              <span className="text-[9px] text-paper-400">
                Not a physical landslide trajectory forecast
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleCompact}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-ink-800 hover:bg-ink-700 text-paper-300 hover:text-paper-50 border border-line-subtle transition cursor-pointer"
                title="Collapse to compact bottom bar"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Compact</span>
              </button>

              <button
                onClick={onClose}
                className="text-paper-400 hover:text-paper-50 p-1 rounded-md hover:bg-ink-800 transition cursor-pointer"
                title="Exit Progression Replay"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
            {/* Timeline Stepper Nodes */}
            <div className="relative flex items-center justify-between px-2">
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-0.5 bg-ink-800" />
              {data.timeline.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isPast = idx < currentStepIndex;

                return (
                  <button
                    key={step.phase}
                    onClick={() => onStepChange(idx)}
                    className="relative z-10 flex flex-col items-center group cursor-pointer focus:outline-none"
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold border-2 transition-all ${
                        isActive
                          ? 'bg-lichen-500 border-paper-50 text-ink-950 scale-110 shadow-md'
                          : isPast
                          ? 'bg-ink-800 border-lichen-500 text-lichen-400'
                          : 'bg-ink-950 border-line-subtle text-paper-400 hover:border-line-strong'
                      }`}
                    >
                      {step.phase === 'EVENT' ? <Zap className="w-3.5 h-3.5" /> : idx + 1}
                    </div>
                    <span
                      className={`text-[10px] font-mono mt-1 ${
                        isActive ? 'text-paper-50 font-bold' : 'text-paper-400'
                      }`}
                    >
                      {step.phase}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Current Step Detail Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-ink-950/80 border border-line-subtle md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-xs font-bold text-paper-50 uppercase tracking-wide">
                    {currentStep.stage_title}
                  </h4>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${badgeClasses.bg} ${badgeClasses.text} ${badgeClasses.border}`}
                  >
                    {currentStep.risk_score.toFixed(2)} · {currentStep.risk_level}
                  </span>
                </div>
                <p className="text-xs text-paper-300 leading-relaxed mb-2">
                  {currentStep.stage_description}
                </p>
                <p className="text-[11px] text-paper-400 italic">
                  Time offset: {currentStep.time_offset_hours}h from trigger
                </p>
              </div>

              <div className="p-3 rounded-lg bg-ink-950/80 border border-line-subtle space-y-2">
                <span className="text-[10px] font-mono text-paper-400 uppercase tracking-wider block">
                  Active Conditions
                </span>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-paper-400">24h Precip:</span>
                  <span className="text-paper-100 font-bold tabular-nums">
                    {currentStep.rainfall_24h} mm
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-paper-400">3d Precip:</span>
                  <span className="text-paper-100 font-bold tabular-nums">
                    {currentStep.rainfall_3d} mm
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-paper-400">Saturation:</span>
                  <span className="text-paper-100 font-bold tabular-nums">
                    {Math.round(currentStep.soil_moisture * 100)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-paper-400">Debris Runout:</span>
                  <span className="text-lichen-400 font-bold tabular-nums">
                    {(currentStep.flow_progress * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};
