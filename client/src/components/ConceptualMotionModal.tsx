import React, { useState, useEffect } from 'react';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Banner */}
        <div className="bg-amber-500/90 text-black font-bold text-xs px-3 py-1.5 text-center w-full z-10 flex-shrink-0 uppercase">
          ILLUSTRATIVE SIMULATION — NOT A PHYSICAL LANDSLIDE FORECAST
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-200">Conceptual Motion Model</h2>
            <p className="text-[10px] text-slate-400">Risk Level: {riskLevel} | Base Slope: {slope}°</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1 rounded-md transition cursor-pointer"
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-lg px-2 cursor-pointer"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Animation Container */}
        <div className="relative h-64 bg-slate-950 overflow-hidden flex-1">
          {/* SVG Animation */}
          <svg viewBox="0 0 800 400" className="w-full h-full">
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
              <linearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#166534" />
                <stop offset="100%" stopColor="#451a03" />
              </linearGradient>
            </defs>

            {/* Background Sky */}
            <rect width="800" height="400" fill="url(#skyGrad)" />

            {/* Saturation Water Level (Saturating Stage) */}
            <rect
              x="0"
              y="400"
              width="800"
              height="400"
              fill="#0ea5e9"
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
              width="800" height="400" 
              fill="#f59e0b"
              className={`transition-opacity duration-1000 ${stage === 'warning' ? 'opacity-20 animate-pulse' : 'opacity-0 pointer-events-none'}`}
            />

            {/* The Hill Slope */}
            <path
              d="M 800 400 L 0 400 L 0 100 Q 400 200 800 350 Z"
              fill="url(#hillGrad)"
            />

            {/* Sliding Debris (Sliding and Deposited stages) */}
            <g className="transition-all duration-[2000ms] ease-in-out"
               style={{
                 opacity: stage === 'sliding' || stage === 'deposited' ? 1 : 0,
                 transform: stage === 'sliding' ? 'translate(200px, 100px)' :
                            stage === 'deposited' ? 'translate(500px, 180px)' : 'translate(0px, 0px)'
               }}
            >
              <circle cx="100" cy="150" r="15" fill="#78350f" />
              <circle cx="130" cy="140" r="20" fill="#78350f" />
              <circle cx="80" cy="170" r="12" fill="#78350f" />
              <path d="M 60 160 L 140 160 L 100 120 Z" fill="#92400e" />
            </g>
            
            {/* Stage Indicator Text Overlay */}
            <text x="400" y="50" fill="white" fontSize="20" fontWeight="bold" textAnchor="middle" opacity="0.8" className="uppercase tracking-widest">
              {stage}
            </text>
          </svg>
        </div>

        {/* Timeline / Stages Progress */}
        <div className="flex bg-slate-900 border-t border-slate-800 p-2 gap-1 text-[10px] font-mono text-center">
          {STAGES.map((s, idx) => (
            <div 
              key={s} 
              className={`flex-1 py-1.5 rounded transition-colors ${idx === stageIndex ? 'bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 font-bold' : 'text-slate-500'}`}
            >
              {s.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
