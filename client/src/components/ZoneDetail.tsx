import React, { useState } from 'react';
import { ArrowLeft, FileText, MapPinned, LocateFixed, Mountain, Activity, History } from 'lucide-react';
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
import { PanelLoading, PanelEmpty, PanelError } from './PanelStates';
import { HistoricalReplayModal } from './HistoricalReplayModal';
import { getRiskColor } from '../lib/riskColors';
import { scoreToPercent, formatEventDate } from '../lib/format';
import { openReportWindow } from '../lib/reportGenerator';

interface ZoneDetailProps {
  zone: RiskZone;
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
  mapViewMode?: 'top' | 'focus';
  onMapViewModeChange?: (mode: 'top' | 'focus') => void;
  terrain3D?: boolean;
  onToggleTerrain?: () => void;
  onLaunchHazardProgression?: (replayId: string) => void;
  onLaunchZoneRunout?: (zoneId: string) => void;
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
  mapViewMode,
  onMapViewModeChange,
  terrain3D,
  onToggleTerrain,
  onLaunchHazardProgression,
  onLaunchZoneRunout,
}) => {
  const [replayEventId, setReplayEventId] = useState<string | null>(null);

  const currentRiskScore = assessment?.risk_score ?? zone.risk_score;
  const currentRiskLevel = assessment?.risk_level ?? zone.risk_level;
  const pct = scoreToPercent(currentRiskScore);
  const color = getRiskColor(currentRiskLevel);
  const isScenarioActive = simulation !== null;
  const activeEngine = simulation?.engine ?? baselinePrediction?.engine ?? null;

  const factors =
    simulation?.contributing_factors ??
    baselinePrediction?.contributing_factors ??
    null;

  return (
    <div className="flex flex-col h-full bg-ink-900 text-paper-100 overflow-hidden">
      {/* Sticky Header with Back & Export Actions */}
      <div className="p-3.5 border-b border-line-subtle flex items-center justify-between gap-2 shrink-0 bg-ink-900/90 backdrop-blur-sm z-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-paper-300 hover:text-paper-50 bg-ink-800 hover:bg-ink-700 px-2.5 py-1.5 rounded-md border border-line-subtle transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
          <span>All Corridors</span>
        </button>

        <span className="text-[11px] font-mono text-paper-400 uppercase tracking-wide">
          ID: {zone.id}
        </span>

        <button
          onClick={() => openReportWindow(zone, simulation ?? baselinePrediction ?? null, environment, events)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-paper-300 hover:text-paper-50 bg-ink-800 hover:bg-ink-700 px-2.5 py-1.5 rounded-md border border-line-subtle transition cursor-pointer"
          title="Generate printable risk assessment report"
        >
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Export</span>
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Corridor Title & Perspective Switcher */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h2 className="text-base font-bold text-paper-50 tracking-tight">{zone.name}</h2>
            <RiskBadge level={currentRiskLevel} className="transition-all duration-500" />
          </div>
          {zone.description && (
            <p className="text-xs text-paper-300 leading-relaxed mb-2.5">{zone.description}</p>
          )}

          {/* Perspective Toolbar */}
          <div className="flex items-center justify-between py-1 px-2 rounded-md bg-ink-950 border border-line-subtle">
            <span className="text-[11px] font-mono text-paper-400">Map Perspective:</span>
            <div className="inline-flex rounded bg-ink-900 border border-line-subtle p-0.5 text-xs gap-0.5">
              <button
                type="button"
                onClick={() => onMapViewModeChange?.('top')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  mapViewMode === 'top' && !terrain3D
                    ? 'bg-lichen-500 text-ink-950 font-semibold shadow'
                    : 'text-paper-400 hover:text-paper-100'
                }`}
                title="Top View [T] (0° Nadir Overview)"
              >
                <MapPinned className="w-3 h-3" aria-hidden="true" />
                <span>Top</span>
                <span className="text-[9px] opacity-70 font-mono">[T]</span>
              </button>
              <button
                type="button"
                onClick={() => onMapViewModeChange?.('focus')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                  mapViewMode === 'focus' && !terrain3D
                    ? 'bg-lichen-500 text-ink-950 font-semibold shadow'
                    : 'text-paper-400 hover:text-paper-100'
                }`}
                title="Focus View [F] (Corridor Close-up)"
              >
                <LocateFixed className="w-3 h-3" aria-hidden="true" />
                <span>Focus</span>
                <span className="text-[9px] opacity-70 font-mono">[F]</span>
              </button>
              {onToggleTerrain && (
                <button
                  type="button"
                  onClick={onToggleTerrain}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                    terrain3D
                      ? 'bg-lichen-500 text-ink-950 font-semibold shadow'
                      : 'text-paper-400 hover:text-paper-100'
                  }`}
                  title={terrain3D ? 'Disable 3D Terrain [D]' : 'Explore 3D Terrain [D] (55° Pitch)'}
                >
                  <Mountain className="w-3 h-3" aria-hidden="true" />
                  <span>{terrain3D ? '3D Active' : '3D'}</span>
                  <span className="text-[9px] opacity-70 font-mono">[D]</span>
                </button>
              )}
            </div>
          </div>

          {/* Predictive Runout Action */}
          {onLaunchZoneRunout && (
            <button
              onClick={() => onLaunchZoneRunout(zone.id)}
              className="w-full mt-2 py-2 px-3 rounded-md bg-ink-950 hover:bg-ink-800 text-lichen-400 border border-lichen-600/40 text-xs font-semibold shadow-sm flex items-center justify-center gap-2 transition cursor-pointer"
              title="Simulate Downslope Debris-Flow Runout based on Current Zone Telemetry"
            >
              <Activity className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulate Predictive Runout (Current Conditions)</span>
            </button>
          )}
        </div>

        {/* Risk Assessment Score Card */}
        <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong shadow-inner space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-400">
              Risk Assessment
            </span>

            <div className="flex items-center gap-1.5 flex-wrap">
              {activeEngine && (
                <span
                  data-testid="engine-badge"
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    (simulation ?? baselinePrediction)?.fallback_used
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : activeEngine === 'hybrid'
                      ? 'bg-glacier-500/15 border-glacier-500/40 text-glacier-300'
                      : 'bg-ink-900 border-line-subtle text-paper-300'
                  }`}
                  title={
                    (simulation ?? baselinePrediction)?.fallback_used
                      ? (simulation ?? baselinePrediction)?.fallback_reason || 'ML surrogate unavailable; running in-process deterministic fallback'
                      : activeEngine === 'hybrid'
                      ? 'Hybrid Engine: Conservative safety floor enforced by physical rainfall threshold'
                      : activeEngine === 'ml'
                      ? 'Synthetic Surrogate Model (0.1.0) — function approximation seam'
                      : 'Deterministic 5-factor weighted heuristic'
                  }
                >
                  {(simulation ?? baselinePrediction)?.fallback_used
                    ? 'Fallback: Heuristic (ML Offline)'
                    : activeEngine === 'hybrid'
                    ? 'Hybrid Safety Floor'
                    : activeEngine === 'ml'
                    ? 'ML Surrogate (v0.1.0)'
                    : 'Deterministic Heuristic'}
                </span>
              )}

              {isScenarioActive ? (
                <span className="px-2 py-0.5 rounded bg-silt-900/60 border border-silt-700 text-silt-300 text-[10px] font-mono uppercase tracking-wider">
                  Scenario
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-ink-900 border border-line-subtle text-paper-400 text-[10px] font-mono uppercase tracking-wider">
                  Observed
                </span>
              )}
            </div>
          </div>

          {pct !== null ? (
            <div>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-mono font-bold text-paper-50 tracking-tight tabular-nums transition-all duration-500">
                  {pct}
                </span>
                <span className="text-sm font-mono text-paper-400">/ 100</span>
                <span className="text-xs font-mono text-paper-300 ml-auto uppercase transition-colors duration-500">
                  {currentRiskLevel} Tier Index
                </span>
              </div>

              {/* Canonical Progress Bar */}
              <div className="w-full h-2 bg-ink-800 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: color,
                  }}
                />
              </div>

              {/* Scientific Honesty Caption & Threshold Metric */}
              <div className="flex items-center justify-between text-[10px] font-mono text-paper-400 mt-1">
                <span>Decision-support index (not probability)</span>
                {(simulation ?? baselinePrediction)?.threshold_signal && (
                  <span
                    className={`tabular-nums ${
                      (simulation ?? baselinePrediction)?.threshold_signal?.exceeded
                        ? 'text-amber-400 font-semibold'
                        : 'text-paper-400'
                    }`}
                    title={(simulation ?? baselinePrediction)?.threshold_signal?.citation}
                  >
                    I-D Thresh: {(simulation ?? baselinePrediction)?.threshold_signal?.max_ratio.toFixed(2)}x ({(simulation ?? baselinePrediction)?.threshold_signal?.critical_duration_days}d)
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-paper-400 italic">No assessment score available</div>
          )}
        </div>

        {/* What-if Scenario Simulator */}
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

        {/* Risk Factor Breakdown */}
        {factors && currentRiskScore !== null && (
          <FactorBreakdown
            factors={factors}
            riskScore={currentRiskScore}
            isScenario={isScenarioActive}
          />
        )}

        {/* 7-Day Risk Trajectory Chart */}
        <RiskTrend
          currentScore={currentRiskScore}
          riskLevel={currentRiskLevel}
          rainfall24h={environment?.rainfall_24h}
          rainfall3d={environment?.rainfall_3d}
          rainfall7d={environment?.rainfall_7d}
        />

        {/* 5-Day Precipitation Forecast */}
        <WeatherForecast
          zoneId={zone.id}
          rainfall24h={environment?.rainfall_24h ?? null}
          riskLevel={currentRiskLevel}
        />

        {/* Response Guidance */}
        <ResponseGuidance riskLevel={currentRiskLevel} zoneName={zone.name} />

        {/* Environmental Telemetry Grid */}
        <div className="p-4 rounded-lg bg-ink-950/80 border border-line-strong shadow-inner space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
              Environmental Telemetry
            </h3>
            {environment?.timestamp && (
              <span className="text-[10px] font-mono text-paper-400">
                Synced {environment.timestamp.slice(0, 10)}
              </span>
            )}
          </div>

          {envLoading ? (
            <PanelLoading message="Acquiring station telemetry..." />
          ) : envError ? (
            <PanelError
              title="Telemetry acquisition failed"
              description={envError.message}
              onRetry={onRetryEnv}
            />
          ) : environment ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">24h Rainfall</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {environment.rainfall_24h ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-paper-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">3-Day Cumulative</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {environment.rainfall_3d ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-paper-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">7-Day Cumulative</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {environment.rainfall_7d ?? '—'}{' '}
                  <span className="text-[10px] font-normal text-paper-400">mm</span>
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">Soil Saturation</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {environment.soil_moisture !== null
                    ? `${Math.round(environment.soil_moisture * 100)} %`
                    : '—'}
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">Local Slope</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {environment.slope ?? zone.base_slope ?? '—'}
                  <span className="text-[10px] font-normal text-paper-400">°</span>
                </span>
              </div>

              <div className="p-2.5 rounded-md bg-ink-900/80 border border-line-subtle">
                <span className="text-paper-400 block text-[11px]">Historical Incidents</span>
                <span className="text-base font-mono font-bold text-paper-50 tabular-nums">
                  {events?.length ?? 0}
                  <span className="text-[10px] font-normal text-paper-400"> in corridor</span>
                </span>
              </div>
            </div>
          ) : (
            <PanelEmpty message="No telemetry observation recorded for this corridor." />
          )}

          {/* Provenance note */}
          <div className="px-3 py-1.5 rounded-md bg-ink-900 border border-line-subtle text-[11px] text-paper-400 flex items-center justify-between">
            <span>Data provenance:</span>
            <span className="font-mono text-monsoon-300 font-medium">
              {environment?.source === 'chirps_real'
                ? 'chirps_real (NASA/USAID SERVIR)'
                : `${environment?.source || zone.data_source || 'synthetic_seed'} (demo)`}
            </span>
          </div>
        </div>

        {/* Historical Events Section */}
        <div className="space-y-2 pt-2 border-t border-line-subtle">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Corridor Historical Incidents</span>
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-ink-950 border border-line-subtle text-paper-300 font-mono">
              {events?.length ?? 0}
            </span>
          </div>

          {eventsLoading ? (
            <PanelLoading message="Loading historical events..." />
          ) : events && events.length > 0 ? (
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="p-2.5 rounded-md bg-ink-950/60 border border-line-subtle text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-paper-400">
                        {formatEventDate(evt.date)}
                      </span>
                      <button
                        onClick={() => setReplayEventId(`replay-${evt.id}`)}
                        className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-ink-800 text-lichen-400 border border-line-subtle rounded hover:bg-ink-700 transition-colors cursor-pointer"
                        title="View Historical Assessment Replay"
                      >
                        Replay
                      </button>
                      {onLaunchHazardProgression && (
                        <button
                          onClick={() => onLaunchHazardProgression(`replay-${evt.id}`)}
                          className="px-2 py-0.5 text-[10px] font-mono font-semibold bg-lichen-700/20 text-lichen-300 border border-lichen-600/40 rounded hover:bg-lichen-700/30 transition-colors cursor-pointer"
                          title="Simulate Downslope Runout for this historical event"
                        >
                          Progression
                        </button>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-paper-400 uppercase">
                      {evt.category || 'Landslide'}
                    </span>
                  </div>

                  {evt.description && (
                    <p className="text-[11px] text-paper-300 leading-normal">{evt.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-paper-400 italic py-1">
              No historical incident points recorded within this corridor boundary.
            </p>
          )}
        </div>

        {/* Alert Incident Audit Log */}
        <AlertHistory zoneId={zone.id} />

        {/* Talweg AI Copilot Panel */}
        <CopilotPanel zoneId={zone.id} />
      </div>

      {/* Historical Replay Modal Dialog */}
      {replayEventId && (
        <HistoricalReplayModal
          id={replayEventId}
          onClose={() => setReplayEventId(null)}
          onLaunchProgression={onLaunchHazardProgression}
        />
      )}
    </div>
  );
};
