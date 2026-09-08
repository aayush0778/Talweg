import React from 'react';
import { RiskLevel } from '../types/api';
import { RISK_COLORS } from '../lib/riskColors';

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
      return RISK_COLORS.LOW;
    case 'MODERATE':
      return RISK_COLORS.MODERATE;
    case 'HIGH':
      return RISK_COLORS.HIGH;
    case 'SEVERE':
      return RISK_COLORS.SEVERE;
    default:
      return '#5f6963';
  }
};

export const HistoricalTimeline: React.FC<HistoricalTimelineProps> = ({ points, isSynthetic }) => {
  return (
    <div className="flex flex-col w-full bg-ink-950 rounded-lg p-3 max-h-[85px] justify-center relative border border-line-strong">
      {isSynthetic && (
        <div className="absolute top-1 right-2 text-[10px] text-paper-400 italic font-mono">
          Illustrative escalation timeline
        </div>
      )}
      <div className="flex items-center justify-between w-full relative mt-3 px-4">
        {/* Connecting Line */}
        <div className="absolute top-[5px] left-4 right-4 h-0.5 bg-ink-800 z-0" />

        {points.map((point, idx) => (
          <div key={idx} className="relative z-10 flex flex-col items-center min-w-[40px]">
            <div
              className="w-3 h-3 rounded-full ring-2 ring-ink-950"
              style={{ backgroundColor: getBadgeColor(point.risk_level) }}
            />
            <div className="mt-1 text-[11px] font-mono text-paper-300">
              {point.label}
            </div>
            <div
              className="text-[10px] font-mono font-bold"
              style={{ color: getBadgeColor(point.risk_level) }}
            >
              {point.risk_score !== null ? point.risk_score.toFixed(1) : '—'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
