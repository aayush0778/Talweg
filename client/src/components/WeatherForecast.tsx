import React, { useEffect, useState } from 'react';
import { CloudRain, Sun, Cloud, CloudLightning, TriangleAlert } from 'lucide-react';
import type { RiskLevel, WeatherForecastDay, ProvenanceInfo } from '../types/api';
import { generateForecast } from '../lib/forecastGenerator';
import { fetchZoneForecast } from '../lib/apiClient';
import { ProvenanceBadge } from './ProvenanceBadge';
import { Skeleton } from './Skeleton';

interface WeatherForecastProps {
  zoneId?: string;
  rainfall24h: number | null;
  riskLevel: RiskLevel | null;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
    const day = parseInt(parts[2], 10);
    return `${month} ${day}`;
  }
  return dateStr;
}

function getWeatherIcon(iconStr: string) {
  const s = (iconStr || '').toLowerCase();
  if (s.includes('rain') || s.includes('🌧')) return <CloudRain className="w-5 h-5 text-monsoon-300" aria-hidden="true" />;
  if (s.includes('sun') || s.includes('☀')) return <Sun className="w-5 h-5 text-amber-400" aria-hidden="true" />;
  if (s.includes('thunder') || s.includes('lightning') || s.includes('⛈')) return <CloudLightning className="w-5 h-5 text-risk-severe" aria-hidden="true" />;
  return <Cloud className="w-5 h-5 text-paper-300" aria-hidden="true" />;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({
  zoneId,
  rainfall24h,
  riskLevel,
}) => {
  const [days, setDays] = useState<WeatherForecastDay[]>(() =>
    generateForecast(rainfall24h, riskLevel)
  );
  const [provenance, setProvenance] = useState<ProvenanceInfo>({
    type: 'SYNTHETIC',
    source: 'Deterministic Seed',
    note: 'Initial forecast view',
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!zoneId) {
      setDays(generateForecast(rainfall24h, riskLevel));
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchZoneForecast(zoneId, rainfall24h)
      .then((res) => {
        if (!isMounted) return;
        setDays(res.forecast_days);
        setProvenance(res.provenance);
      })
      .catch(() => {
        if (!isMounted) return;
        setDays(generateForecast(rainfall24h, riskLevel));
        setProvenance({
          type: 'SYNTHETIC',
          source: 'TALWEG Fallback',
          note: 'Offline fallback — live meteorological forecast unavailable',
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [zoneId, rainfall24h, riskLevel]);

  const hasWarning = days.some((d) => d.warning);

  return (
    <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CloudRain className="w-4 h-4 text-monsoon-300" aria-hidden="true" />
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
            5-Day Precipitation
          </span>
          {hasWarning && (
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-risk-high/15 border border-risk-high/40 text-risk-high font-mono font-bold animate-pulse">
              <TriangleAlert className="w-3 h-3" aria-hidden="true" />
              <span>HEAVY RAIN</span>
            </span>
          )}
        </div>
        <ProvenanceBadge type={provenance.type} note={provenance.note} />
      </div>

      {loading ? (
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-2 rounded bg-ink-900 border border-line-subtle flex flex-col items-center space-y-1">
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 overflow-x-auto">
          {days.map((day, idx) => (
            <div
              key={day.date || idx}
              className={`flex flex-col items-center p-2 rounded border transition min-w-[52px] ${
                day.warning
                  ? 'bg-risk-high/10 border-risk-high/40'
                  : 'bg-ink-900 border-line-subtle'
              }`}
            >
              <span className="text-[10px] font-mono text-paper-400">{day.day}</span>
              <span className="text-[9px] font-mono text-paper-400">{formatDisplayDate(day.date)}</span>
              <div className="my-1">{getWeatherIcon(day.icon)}</div>
              <span
                className={`text-xs font-mono font-bold tabular-nums ${
                  day.warning ? 'text-risk-high' : 'text-paper-100'
                }`}
              >
                {day.rainfall_mm}
              </span>
              <span className="text-[9px] font-mono text-paper-400">mm</span>
              {day.probability_pct != null && (
                <span className="text-[8px] font-mono text-lichen-400 mt-0.5">
                  {day.probability_pct}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-paper-400 leading-normal">
        {provenance.type === 'REAL'
          ? 'Live 5-day NWP precipitation forecast assimilating India Meteorological Department (IMD) & NCMRWF regional models.'
          : 'Simulated fallback forecast based on monitoring data. Automatically connects to live IMD/NCMRWF NWP forecasts when online.'}
      </p>
    </div>
  );
};
