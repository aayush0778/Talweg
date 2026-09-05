import React, { useEffect, useState } from 'react';
import type { RiskLevel, WeatherForecastDay, ProvenanceInfo } from '../types/api';
import { generateForecast } from '../lib/forecastGenerator';
import { fetchZoneForecast } from '../lib/apiClient';
import { ProvenanceBadge } from './ProvenanceBadge';

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
          source: 'TALWEG Deterministic Fallback',
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
    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            🌧️ 5-Day Rainfall Forecast
          </span>
          {hasWarning && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950/80 border border-orange-800/60 text-orange-300 font-mono font-bold animate-pulse">
              ⚠ HEAVY RAIN
            </span>
          )}
          {loading && (
            <span className="text-[10px] text-slate-500 animate-pulse">Updating...</span>
          )}
        </div>
        <ProvenanceBadge type={provenance.type} note={provenance.note} />
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {days.map((day, idx) => (
          <div
            key={day.date || idx}
            className={`flex flex-col items-center p-2 rounded-lg border transition ${
              day.warning
                ? 'bg-orange-950/30 border-orange-800/60'
                : 'bg-slate-900/50 border-slate-800/50'
            }`}
          >
            <span className="text-[10px] font-medium text-slate-400">{day.day}</span>
            <span className="text-[9px] text-slate-500">{formatDisplayDate(day.date)}</span>
            <span className="text-lg my-1">{day.icon}</span>
            <span
              className={`text-xs font-bold ${
                day.warning ? 'text-orange-300' : 'text-slate-200'
              }`}
            >
              {day.rainfall_mm}
            </span>
            <span className="text-[9px] text-slate-500">mm</span>
            {day.probability_pct != null && (
              <span className="text-[8px] font-mono text-cyan-400/80 mt-0.5">
                {day.probability_pct}%
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        {provenance.type === 'REAL'
          ? 'Live 5-day NWP precipitation forecast assimilating India Meteorological Department (IMD) & NCMRWF regional models.'
          : 'Simulated fallback forecast based on monitoring data. Automatically connects to live IMD/NCMRWF NWP forecasts when online.'}
      </p>
    </div>
  );
};
