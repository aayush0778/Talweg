import React from 'react';
import {
  RiskZone,
  EnvironmentObservation,
  LandslideEvent,
  RiskLevel,
  RiskPredictionResponse,
} from '../types/api';
import { ScenarioValues } from '../lib/scenario';
import { ScenarioSimulator } from './ScenarioSimulator';
import { FactorBreakdown } from './FactorBreakdown';
import { ResponseGuidance } from './ResponseGuidance';
import { WeatherForecast } from './WeatherForecast';
import { RiskTrend } from './RiskTrend';
import { AlertHistory } from './AlertHistory';
import { CopilotPanel } from './CopilotPanel';
import { RiskBadge } from './RiskBadge';
import { StatusMessage } from './StatusMessage';
import { getRiskColor } from '../lib/riskColors';
import { scoreToPercent, formatObsTimestamp, formatEventDate } from '../lib/format';
import { openReportWindow } from '../lib/reportGenerator';

interface ZoneDetailProps {
  zone: RiskZone;
  /**
   * Assessment prop: passed from simulation in Phase 4,
   * falling back to zone baseline.
   */
  assessment: {
    risk_score: number | null;
    risk_level: RiskLevel | null;
    timestamp: string | null;
  } | null;
  simulation: RiskPredictionResponse | null;
  baselinePrediction?: RiskPredictionResponse | null;
  scenarioValues: ScenarioValues | null;
  setScenarioValues: React.Dispatch<React.SetStateAction<ScenarioValues | null>>;
  simLoading: boolean;
  simError: Error | null;
  isScenarioModified: boolean;
  scenarioAvailable: boolean;
  onResetScenario: () => void;
  environment: EnvironmentObservation | null;
  envLoading: boolean;
  envError: Error | null;
  events: LandslideEvent[] | null;
  eventsLoading: boolean;
  onBack: () => void;
  onRetryEnv?: () => void;
}

export const ZoneDetail: React.FC<ZoneDetailProps> = ({
  zone,
  assessment,
  simulation,
  baselinePrediction = null,
  scenarioValues,
  setScenarioValues,
  simLoading,
  simError,
  isScenarioModified,
  scenarioAvailable,
  onResetScenario,
  environment,
  envLoading,
  envError,
  events,
  eventsLoading,
  onBack,
  onRetryEnv,
}) => {
  const currentRiskScore = assessment?.risk_score ?? zone.risk_score;
  const currentRiskLevel = assessment?.risk_level ?? zone.risk_level;
  const pct = scoreToPercent(currentRiskScore);
  const baselinePct = scoreToPercent(zone.risk_score);
  const color = getRiskColor(currentRiskLevel);
  const isScenarioActive = simulation !== null;
  const levelChanged = isScenarioActive && currentRiskLevel !== zone.risk_level;
  const activeEngine = simulation?.engine ?? baselinePrediction?.engine ?? null;

  const factors =
    simulation?.contributing_factors ??
    baselinePrediction?.contributing_factors ??
    null;

  return (
    <div className="flex flex-col h-full">
      {/* Header & Back Button */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between gap-2 shrink-0">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition cursor-pointer"
        >
          <span>←</span>
          <span>All Zones</span>
        </button>

        <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">
          ID: {zone.id}
        </span>

        <button
          onClick={() => openReportWindow(zone, simulation ?? baselinePrediction ?? null, environment, events)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition cursor-pointer"
          title="Generate printable risk assessment report"
        >
          <span>📄</span>
          <span>Export Report</span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Zone Overview */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h2 className="text-base font-bold text-white tracking-tight">{zone.name}</h2>
            <RiskBadge level={currentRiskLevel} className="transition-all duration-500" />
          </div>
          {zone.description && (
            <p className="text-xs text-slate-300 leading-relaxed">{zone.description}</p>
          )}
        </div>

        {/* Risk Score Card (with OBSERVED vs SCENARIO State and ML Engine Badge) */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-inner space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Landslide Risk Assessment
            </span>

            <div className="flex items-center gap-1.5">
              {activeEngine && (
                <span
                  data-testid="engine-badge"
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    activeEngine === 'ml'
                      ? 'bg-emerald-950/80 border-emerald-700/60 text-emerald-300'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-400'
                  }`}
                >
                  {activeEngine === 'ml' ? 'ML Surrogate (RF)' : 'Deterministic Heuristic'}
                </span>
              )}

              {isScenarioActive ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-950/90 border border-amber-700/70 text-amber-300 text-[10px] font-bold tracking-wider uppercase animate-pulse">
                  Scenario
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-slate-800/90 border border-slate-700/70 text-slate-400 text-[10px] font-semibold tracking-wider uppercase">
                  Observed
                </span>
              )}
            </div>
          </div>

          {pct !== null ? (
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-black text-white tracking-tight transition-all duration-500">
                  {pct}
                </span>
                <span className="text-sm font-semibold text-slate-500">/ 100</span>
                <span className="text-xs font-medium text-slate-300 ml-auto capitalize transition-colors duration-500">
                  {currentRiskLevel?.toLowerCase()} Severity Index
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              {/* Scenario Baseline Transition Sub-line */}
              {isScenarioActive && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1 text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Baseline (measured):</span>
                    <span className="font-mono text-slate-300 font-medium">
                      {zone.risk_level ?? '—'} · {baselinePct}/100
                    </span>
                  </div>

                  {levelChanged && (
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-400 text-[11px]">Risk Level Transition:</span>
                      <span className="text-amber-400 font-mono tracking-tight">
                        {zone.risk_level} → {currentRiskLevel}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-400 italic py-2">Risk evaluation pending telemetry</div>
          )}
        </div>

        {/* 7-Day Risk Trajectory Trend */}
        <RiskTrend
          currentScore={currentRiskScore}
          riskLevel={currentRiskLevel}
          rainfall24h={environment?.rainfall_24h}
          rainfall3d={environment?.rainfall_3d}
          rainfall7d={environment?.rainfall_7d}
        />

        {/* P0-B.1: Risk Factor Breakdown */}
        {factors && factors.length > 0 && (
          <FactorBreakdown
            factors={factors}
            riskScore={currentRiskScore ?? 0}
            isScenario={isScenarioActive}
          />
        )}

        {/* Evacuation Response Guidance Panel */}
        <ResponseGuidance 
          riskLevel={currentRiskLevel} 
          zoneName={zone.name} 
        />

        {/* 5-Day Weather Forecast Preview */}
        <WeatherForecast
          rainfall24h={environment?.rainfall_24h ?? null}
          riskLevel={currentRiskLevel}
        />

        {/* Live Rainfall Scenario Simulator */}
        <ScenarioSimulator
          values={scenarioValues}
          setValues={setScenarioValues}
          environment={environment}
          simLoading={simLoading}
          simError={simError}
          isModified={isScenarioModified}
          available={scenarioAvailable}
          onReset={onResetScenario}
        />

        {/* Telemetry Grid (Always Shows Measured Baseline Observations) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Environmental Telemetry (Observed)
            </h3>
            {environment?.timestamp && (
              <span className="text-[10px] text-slate-500 font-mono">
                {formatObsTimestamp(environment.timestamp)}
              </span>
            )}
          </div>

          {envLoading ? (
            <StatusMessage type="loading" message="Loading environmental telemetry..." />
          ) : envError ? (
            <StatusMessage
              type="error"
              title="Telemetry Unavailable"
              message={envError.message}
              onRetry={onRetryEnv}
            />
          ) : environment ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">24h Rainfall</span>
                <span className="text-base font-bold text-white">
                  {environment.rainfall_24h ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-slate-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">3-Day Cumulative</span>
                <span className="text-base font-bold text-white">
                  {environment.rainfall_3d ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-slate-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">7-Day Cumulative</span>
                <span className="text-base font-bold text-white">
                  {environment.rainfall_7d ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-slate-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Soil Saturation</span>
                <span className="text-base font-bold text-white">
                  {environment.soil_moisture !== null
                    ? `${Math.round(environment.soil_moisture * 100)} %`
                    : '—'}
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Local Slope</span>
                <span className="text-base font-bold text-white">
                  {environment.slope ?? zone.base_slope ?? '—'}
                  <span className="text-[10px] font-normal text-slate-400">°</span>
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/70 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Historical Incidents</span>
                <span className="text-base font-bold text-white">
                  {events?.length ?? 0}
                  <span className="text-[10px] font-normal text-slate-400"> in corridor</span>
                </span>
              </div>
            </div>
          ) : (
            <StatusMessage type="empty" message="No telemetry observation recorded for this zone." />
          )}

          {/* Provenance note */}
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/40 border border-slate-800/60 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Data provenance:</span>
            <span className="font-mono text-cyan-400/90 font-medium">
              {environment?.source || zone.data_source || 'synthetic_seed'} (demo)
            </span>
          </div>
        </div>

        {/* Historical Events Section */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Corridor Historical Slides
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {events?.length ?? 0}
            </span>
          </div>

          {eventsLoading ? (
            <StatusMessage type="loading" message="Loading historical events..." />
          ) : events && events.length > 0 ? (
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatEventDate(evt.date)}
                    </span>
                    <div className="flex gap-1">
                      {evt.trigger && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-blue-950 text-blue-300 rounded border border-blue-900/60">
                          {evt.trigger}
                        </span>
                      )}
                      {evt.category && (
                        <span className="px-1.5 py-0.2 text-[10px] bg-amber-950 text-amber-300 rounded border border-amber-900/60">
                          {evt.category}
                        </span>
                      )}
                    </div>
                  </div>
                  {evt.description && (
                    <p className="text-slate-300 text-[11px] leading-relaxed">{evt.description}</p>
                  )}
                  {evt.fatalities !== null && evt.fatalities > 0 && (
                    <div className="text-[10px] text-rose-400 font-medium">
                      ⚠️ {evt.fatalities} reported fatalities
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-slate-500 p-3 text-center bg-slate-900/30 rounded-lg border border-slate-800/40">
              No historical landslide events registered within this polygon.
            </div>
          )}
        </div>

        {/* Alert History & Incident Audit Log */}
        <AlertHistory zoneId={zone.id} />

        {/* P0-B.3: Constrained AI Copilot Section */}
        <CopilotPanel zoneId={zone.id} />
      </div>
    </div>
  );
};
