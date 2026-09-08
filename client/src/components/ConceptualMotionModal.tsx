import React, { useState, useEffect } from 'react';
import { Play, Pause, X } from 'lucide-react';
import { RiskLevel } from '../types/api';

interface ConceptualMotionModalProps {
  riskLevel: RiskLevel;
  slope?: number;
  onClose: () => void;
}

type Stage = 'stable' | 'saturating' | 'warning' | 'sliding' | 'deposited';

const STAGES: Stage[] = ['stable', 'saturating', 'warning', 'sliding', 'deposited'];

export const ConceptualMotionModal: React.FC<ConceptualMotionModalProps> = ({ riskLevel, slope = 35, onClose }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  const stage = STAGES[stageIndex];

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      setStageIndex((prev) => (prev + 1) % STAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-ink-900 border border-line-strong rounded-xl shadow-drawer overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="bg-silt-700 text-ink-950 font-mono font-bold text-xs px-3 py-1.5 text-center w-full z-10 flex-shrink-0 uppercase tracking-wide">
          ILLUSTRATIVE SIMULATION — NOT A PHYSICAL LANDSLIDE FORECAST
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-line-subtle bg-ink-950/60">
          <div>
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-100">
              Conceptual Slope Kinematics
            </h2>
            <p className="text-[10px] font-mono text-paper-400">Risk Tier: {riskLevel} | Base Slope: {slope}°</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-xs font-mono bg-ink-800 hover:bg-ink-700 text-paper-200 px-3 py-1 rounded border border-line-subtle transition cursor-pointer flex items-center gap-1.5"
            >
              {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-paper-400 hover:text-paper-100 p-1 rounded transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Animation Container */}
        <div className="relative h-64 bg-ink-950 overflow-hidden flex-1">
          <svg viewBox="0 0 800 400" className="w-full h-full">
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#101417" />
                <stop offset="100%" stopColor="#171e22" />
              </linearGradient>
              <linearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#303c40" />
                <stop offset="100%" stopColor="#171e22" />
              </linearGradient>
            </defs>

            <rect width="800" height="400" fill="url(#skyGrad)" />

            {/* Saturation Water Level */}
            <rect
              x="0"
              y="400"
              width="800"
              height="400"
              fill="#5299b8"
              opacity="0.3"
              className="transition-transform duration-[2000ms] ease-in-out"
              style={{
                transform: `translateY(${
                  stage === 'stable' ? '0px' :
                  stage === 'saturating' ? '-150px' :
                  '-200px'
                })`
              }}
            />

            {/* Warning Overlay */}
            <rect
              width="800"
              height="400"
              fill="#e49a62"
              className={`transition-opacity duration-1000 ${stage === 'warning' ? 'opacity-20 animate-pulse' : 'opacity-0 pointer-events-none'}`}
            />

            {/* Hill Slope */}
            <path
              d="M 800 400 L 0 400 L 0 100 Q 400 200 800 350 Z"
              fill="url(#hillGrad)"
            />

            {/* Sliding Debris */}
            <g
              className="transition-all duration-[2000ms] ease-in-out"
              style={{
                opacity: stage === 'sliding' || stage === 'deposited' ? 1 : 0,
                transform: stage === 'sliding' ? 'translate(200px, 100px)' :
                           stage === 'deposited' ? 'translate(500px, 180px)' : 'translate(0px, 0px)'
              }}
            >
              <circle cx="100" cy="150" r="15" fill="#405054" />
              <circle cx="130" cy="140" r="20" fill="#405054" />
              <circle cx="80" cy="170" r="12" fill="#405054" />
              <path d="M 60 160 L 140 160 L 100 120 Z" fill="#5f6963" />
            </g>

            {/* Stage Indicator Text */}
            <text x="400" y="50" fill="#f2efe9" fontSize="18" fontWeight="bold" textAnchor="middle" opacity="0.8" className="uppercase font-mono tracking-widest">
              {stage}
            </text>
          </svg>
        </div>

        {/* Timeline Progress */}
        <div className="flex bg-ink-950 border-t border-line-subtle p-2 gap-1 text-[10px] font-mono text-center">
          {STAGES.map((s, idx) => (
            <div
              key={s}
              className={`flex-1 py-1 rounded transition-colors ${
                idx === stageIndex ? 'bg-lichen-700/30 text-lichen-300 border border-lichen-600/40 font-bold' : 'text-paper-400'
              }`}
            >
              {s.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
