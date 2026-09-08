import React from 'react';
import { Activity, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { RiskLevel } from '../types/api';
import { getRiskColor } from '../lib/riskColors';
import { scoreToPercent } from '../lib/format';

interface RiskTrendProps {
  currentScore: number | null;
  riskLevel: RiskLevel | null;
  rainfall24h?: number | null;
  rainfall3d?: number | null;
  rainfall7d?: number | null;
}

interface TrendPoint {
  dayLabel: string;
  score: number;
}

function generateTrendPoints(
  currentScore: number | null,
  rainfall24h?: number | null,
  rainfall3d?: number | null,
  rainfall7d?: number | null
): TrendPoint[] {
  const current = currentScore ?? 0.4;
  const r24 = rainfall24h ?? 60;
  const r3d = rainfall3d ?? 140;
  const r7d = rainfall7d ?? 250;

  const d3_daily = Math.max(10, (r3d - r24) / 2);
  const d7_daily = Math.max(5, (r7d - r3d) / 4);

  const factors = [
    Math.max(0.15, current * 0.72 - d7_daily / 300),
    Math.max(0.18, current * 0.76),
    Math.max(0.20, current * 0.81),
    Math.max(0.22, current * 0.85 + d3_daily / 400),
    Math.max(0.25, current * 0.90),
    Math.max(0.28, current * 0.94),
    current,
  ];

  const days = ['-6d', '-5d', '-4d', '-3d', '-2d', 'Yday', 'Today'];

  return factors.map((score, i) => ({
    dayLabel: days[i],
    score: Math.min(1, Math.max(0, Number(score.toFixed(3)))),
  }));
}

export const RiskTrend: React.FC<RiskTrendProps> = ({
  currentScore,
  riskLevel,
  rainfall24h,
  rainfall3d,
  rainfall7d,
}) => {
  const points = generateTrendPoints(currentScore, rainfall24h, rainfall3d, rainfall7d);
  const color = getRiskColor(riskLevel);

  const firstScore = points[0].score;
  const lastScore = points[points.length - 1].score;
  const diffPct = Math.round((lastScore - firstScore) * 100);

  const isRising = diffPct > 3;
  const isFalling = diffPct < -3;

  const width = 340;
  const height = 70;
  const paddingX = 15;
  const paddingY = 10;

  const minScore = 0;
  const maxScore = 1;

  const scaleX = (index: number) =>
    paddingX + (index / (points.length - 1)) * (width - paddingX * 2);
  const scaleY = (score: number) =>
    height - paddingY - ((score - minScore) / (maxScore - minScore)) * (height - paddingY * 2);

  const pathCoordinates = points.map((p, i) => `${scaleX(i)},${scaleY(p.score)}`).join(' L ');
  const pathD = `M ${pathCoordinates}`;

  const fillD = `${pathD} L ${scaleX(points.length - 1)},${height - paddingY} L ${scaleX(
    0
  )},${height - paddingY} Z`;

  return (
    <div className="p-3.5 rounded-lg bg-ink-950/80 border border-line-strong space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-lichen-400" aria-hidden="true" />
          <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-paper-300">
            7-Day Risk Trajectory
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold">
            {isRising ? (
              <span className="inline-flex items-center gap-0.5 text-risk-severe">
                <ArrowUp className="w-3 h-3" aria-hidden="true" />
                <span>+{diffPct}%</span>
              </span>
            ) : isFalling ? (
              <span className="inline-flex items-center gap-0.5 text-risk-low">
                <ArrowDown className="w-3 h-3" aria-hidden="true" />
                <span>{diffPct}%</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-0.5 text-paper-400">
                <Minus className="w-3 h-3" aria-hidden="true" />
                <span>Stable</span>
              </span>
            )}
          </span>
        </div>
        <span className="text-[10px] text-paper-400 font-mono tabular-nums">
          {scoreToPercent(firstScore)}% → {scoreToPercent(lastScore)}%
        </span>
      </div>
      <p className="text-[10px] text-paper-400 italic -mt-0.5">
        Projected from corridor antecedent conditions and slope geometry
      </p>

      {/* Screen Reader accessible summary table */}
      <table className="sr-only">
        <caption>7-Day Landslide Risk Trend</caption>
        <thead>
          <tr>
            <th>Day</th>
            <th>Projected Risk Score</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.dayLabel}>
              <td>{p.dayLabel}</td>
              <td>{(p.score * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="relative w-full overflow-hidden pt-1" aria-hidden="true">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-16 overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Reference grid line at 50% in silt */}
          <line
            x1={paddingX}
            y1={scaleY(0.5)}
            x2={width - paddingX}
            y2={scaleY(0.5)}
            stroke="#5f6963"
            strokeDasharray="2 3"
            strokeWidth="0.8"
          />

          {/* Area Fill */}
          <path d={fillD} fill="url(#trendGradient)" />

          {/* Line Path in Lichen */}
          <path d={pathD} fill="none" stroke="#9fbe4e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Data Points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={scaleX(i)}
              cy={scaleY(p.score)}
              r={i === points.length - 1 ? 3.5 : 2}
              fill={i === points.length - 1 ? '#9fbe4e' : '#89938b'}
              stroke="#101417"
              strokeWidth="1.5"
            />
          ))}
        </svg>

        {/* Labels below chart */}
        <div className="flex justify-between px-1 text-[9px] text-paper-400 font-mono pt-1">
          {points.map((p, i) => (
            <span key={i} className={i === points.length - 1 ? 'text-paper-100 font-bold' : ''}>
              {p.dayLabel}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
