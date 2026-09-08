import React, { useState } from 'react';
import {
  RiskZone,
  EnvironmentObservation,
  LandslideEvent,
  RiskLevel,
  RiskPredictionResponse,
} from '../types/api';
import { ScenarioValues } from '../lib/scenario';
import { ZoneList } from './ZoneList';
import { ZoneDetail } from './ZoneDetail';
import { PanelError, PanelEmpty } from './PanelStates';
import { ZoneComparison } from './ZoneComparison';
import { Skeleton, SkeletonCard } from './Skeleton';
import { SidebarResizeHandle } from './SidebarResizeHandle';

interface ZonePanelProps {
  sidebarWidth?: number;
  isDesktop?: boolean;
  onResizePointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeDoubleClick?: () => void;
  onResizeNudge?: (dx: number) => void;
  zones: RiskZone[] | null;
  zonesLoading: boolean;
  zonesError: Error | null;
  selectedZone: RiskZone | null;
  assessment?: {
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
  zoneEvents: LandslideEvent[] | null;
  zoneEventsLoading: boolean;
  onSelectZone: (zoneId: string) => void;
  onBackToList: () => void;
  onRetryZones: () => void;
  onRetryEnv: () => void;
  mapViewMode?: 'top' | 'focus';
  onMapViewModeChange?: (mode: 'top' | 'focus') => void;
  terrain3D?: boolean;
  onToggleTerrain?: () => void;
  onLaunchHazardProgression?: (replayId: string) => void;
  onLaunchZoneRunout?: (zoneId: string) => void;
}

export const ZonePanel: React.FC<ZonePanelProps> = ({
  sidebarWidth,
  isDesktop = true,
  onResizePointerDown,
  onResizeDoubleClick,
  onResizeNudge,
  zones,
  zonesLoading,
  zonesError,
  selectedZone,
  assessment = null,
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
  zoneEvents,
  zoneEventsLoading,
  onSelectZone,
  onBackToList,
  onRetryZones,
  onRetryEnv,
  mapViewMode,
  onMapViewModeChange,
  terrain3D,
  onToggleTerrain,
  onLaunchHazardProgression,
  onLaunchZoneRunout,
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');

  // Desktop side panel vs. Mobile bottom sheet
  const panelClasses = isDesktop
    ? 'absolute top-20 right-6 bottom-6 w-[420px] max-w-[min(640px,46vw)] z-20 bg-ink-900/95 backdrop-blur-md border border-line-strong shadow-drawer rounded-2xl flex flex-col overflow-hidden pointer-events-auto'
    : 'fixed inset-x-0 bottom-0 z-40 max-h-[92dvh] bg-ink-900/98 backdrop-blur-xl border-t border-line-strong shadow-drawer rounded-t-2xl flex flex-col overflow-hidden pointer-events-auto pb-[env(safe-area-inset-bottom,1rem)]';

  return (
    <aside
      style={isDesktop && sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
      className={panelClasses}
    >
      {/* Mobile drag handle */}
      {!isDesktop && (
        <div className="w-12 h-1.5 bg-ink-700 rounded-full my-2 mx-auto shrink-0" aria-hidden="true" />
      )}

      {/* Desktop resize handle */}
      {isDesktop && onResizePointerDown && onResizeDoubleClick && onResizeNudge && (
        <div className="absolute left-0 top-0 bottom-0 z-30 flex items-stretch">
          <SidebarResizeHandle
            onPointerDown={onResizePointerDown}
            onDoubleClick={onResizeDoubleClick}
            onNudge={onResizeNudge}
          />
        </div>
      )}

      {zonesLoading ? (
        <div className="p-4 space-y-3 overflow-y-auto" role="status" aria-busy="true">
          <div className="flex justify-between items-center pb-2 border-b border-line-subtle">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : zonesError ? (
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <PanelError
            title="Failed to Load Risk Corridors"
            message={zonesError.message}
            onRetry={onRetryZones}
          />
        </div>
      ) : selectedZone ? (
        <ZoneDetail
          zone={selectedZone}
          assessment={assessment ?? selectedZone}
          simulation={simulation}
          baselinePrediction={baselinePrediction}
          scenarioValues={scenarioValues}
          setScenarioValues={setScenarioValues}
          simLoading={simLoading}
          simError={simError}
          isScenarioModified={isScenarioModified}
          scenarioAvailable={scenarioAvailable}
          onResetScenario={onResetScenario}
          environment={environment}
          envLoading={envLoading}
          envError={envError}
          events={zoneEvents}
          eventsLoading={zoneEventsLoading}
          onBack={onBackToList}
          onRetryEnv={onRetryEnv}
          mapViewMode={mapViewMode}
          onMapViewModeChange={onMapViewModeChange}
          terrain3D={terrain3D}
          onToggleTerrain={onToggleTerrain}
          onLaunchHazardProgression={onLaunchHazardProgression}
          onLaunchZoneRunout={onLaunchZoneRunout}
        />
      ) : zones && zones.length > 0 ? (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex-none p-3.5 pb-2 flex justify-between items-center border-b border-line-subtle">
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
              Corridor Intelligence
            </h2>
            <div className="flex items-center gap-1 bg-ink-950 p-0.5 rounded-md border border-line-subtle">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-lichen-500 text-ink-950 font-semibold shadow-sm'
                    : 'text-paper-400 hover:text-paper-100'
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode('dashboard')}
                className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                  viewMode === 'dashboard'
                    ? 'bg-lichen-500 text-ink-950 font-semibold shadow-sm'
                    : 'text-paper-400 hover:text-paper-100'
                }`}
              >
                Matrix
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {viewMode === 'list' ? (
              <ZoneList zones={zones} selectedZoneId={null} onSelectZone={onSelectZone} />
            ) : (
              <ZoneComparison zones={zones} onSelectZone={onSelectZone} />
            )}
          </div>
        </div>
      ) : (
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <PanelEmpty message="No risk corridors recorded for this regional bounding box." />
        </div>
      )}
    </aside>
  );
};
