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
import { StatusMessage } from './StatusMessage';
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
}

export const ZonePanel: React.FC<ZonePanelProps> = ({
  sidebarWidth,
  isDesktop,
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
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'dashboard'>('list');

  return (
    <aside
      style={isDesktop && sidebarWidth ? { width: `${sidebarWidth}px` } : undefined}
      className="absolute top-20 right-6 bottom-6 w-[400px] z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto"
    >
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
        <div className="p-4 space-y-3 overflow-y-auto">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800/80">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : zonesError ? (
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <StatusMessage
            type="error"
            title="Failed to Load Risk Zones"
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
        />
      ) : zones && zones.length > 0 ? (
        <div className="flex flex-col h-full">
          <div className="flex-none p-4 pb-2 flex justify-between items-center border-b border-slate-800/80">
            <h2 className="text-lg font-semibold text-slate-100">Risk Zones</h2>
            <div className="flex items-center gap-1 bg-slate-800/60 rounded-lg p-0.5">
              <button 
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >List</button>
              <button 
                onClick={() => setViewMode('dashboard')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${viewMode === 'dashboard' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
              >Dashboard</button>
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
          <StatusMessage type="empty" message="No risk zones available for this region." />
        </div>
      )}
    </aside>
  );
};
