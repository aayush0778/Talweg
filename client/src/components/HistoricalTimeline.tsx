import React from 'react';
import { RiskLevel } from '../types/api';

export interface TimelinePoint {
  label: string;
  risk_score: number | null;
  risk_level: RiskLevel | null;
}

export interface HistoricalTimelineProps {
  points: TimelinePoint[];
  isSynthetic?: boolean;
}

const getBadgeColor = (level: RiskLevel | null) => {
  switch (level) {
    case 'LOW':
      return 'bg-emerald-500';
    case 'MODERATE':
      return 'bg-amber-500';
    case 'HIGH':
      return 'bg-orange-500';
    case 'SEVERE':
      return 'bg-red-500';
    default:
      return 'bg-slate-600';
  }
};

const getTextColor = (level: RiskLevel | null) => {
  switch (level) {
    case 'LOW':
      return 'text-emerald-400';
    case 'MODERATE':
      return 'text-amber-400';
    case 'HIGH':
      return 'text-orange-400';
    case 'SEVERE':
      return 'text-red-400';
    default:
      return 'text-slate-400';
  }
};

/**
 * HistoricalTimeline displays a horizontal timeline of risk escalation.
 * Phase P0.2 Implementation
 */
export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({ points, isSynthetic }) => {
  return (
    <div className="flex flex-col w-full bg-slate-800 rounded-lg p-3 max-h-[85px] justify-center relative border border-slate-700">
      {isSynthetic && (
        <div className="absolute top-1 right-2 text-[10px] text-slate-400 italic font-medium">
          Illustrative simulation timeline
        </div>
      )}
      <div className="flex items-center justify-between w-full relative mt-3 px-4">
        {/* Connecting Line */}
        <div className="absolute top-[5px] left-4 right-4 h-0.5 bg-slate-700 z-0" />
        
        {points.map((point, idx) => (
          <div key={idx} className="relative z-10 flex flex-col items-center min-w-[40px]">
            <div className={`w-3 h-3 rounded-full ring-2 ring-slate-800 ${getBadgeColor(point.risk_level)}`} />
            <div className="mt-1 text-[11px] font-medium text-slate-300">
              {point.label}
            </div>
            <div className={`text-[10px] font-bold ${getTextColor(point.risk_level)}`}>
              {point.risk_score !== null ? point.risk_score.toFixed(1) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
