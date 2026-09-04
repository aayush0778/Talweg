import React from 'react';
import type { RiskLevel } from '../types/api';
import { generateForecast } from '../lib/forecastGenerator';

interface WeatherForecastProps {
  rainfall24h: number | null;
  riskLevel: RiskLevel | null;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({ rainfall24h, riskLevel }) => {
  const forecast = generateForecast(rainfall24h, riskLevel);
  const hasWarning = forecast.some((d) => d.warning);

  return (
    <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            🌧️ 5-Day Rainfall Forecast
          </span>
          {hasWarning && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-950/80 border border-orange-800/60 text-orange-300 font-mono font-bold">
              ⚠ HEAVY RAIN
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-500 italic">Simulated · IMD integration ready</span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {forecast.map((day) => (
          <div
            key={day.date}
            className={`flex flex-col items-center p-2 rounded-lg border transition ${
              day.warning
                ? 'bg-orange-950/30 border-orange-800/60'
                : 'bg-slate-900/50 border-slate-800/50'
            }`}
          >
            <span className="text-[10px] font-medium text-slate-400">{day.day}</span>
            <span className="text-[9px] text-slate-500">{day.date}</span>
            <span className="text-lg my-1">{day.icon}</span>
            <span
              className={`text-xs font-bold ${
                day.warning ? 'text-orange-300' : 'text-slate-200'
              }`}
            >
              {day.rainfall_mm}
            </span>
            <span className="text-[9px] text-slate-500">mm</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        Simulated forecast based on current monitoring data. Production deployment integrates India
        Meteorological Department (IMD) district-level QPF.
      </p>
    </div>
  );
};
