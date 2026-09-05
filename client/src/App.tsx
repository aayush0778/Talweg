import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { MapView, MapViewHandle } from './components/MapView';
import { ZonePanel } from './components/ZonePanel';
import { AlertBanner } from './components/AlertBanner';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { MapErrorBoundary } from './components/MapErrorBoundary';
import { HazardProgressionPlayer } from './components/HazardProgressionPlayer';
import { HazardProgressionResponse } from './types/api';
import { useApiResource } from './hooks/useApiResource';
import { useHealth } from './hooks/useHealth';
import { useScenario } from './hooks/useScenario';
import { useAlerts } from './hooks/useAlerts';
import { useSidebarResize } from './hooks/useSidebarResize';
import { applySimulationToZones } from './lib/scenario';
import {
  fetchRegions,
  fetchRiskZones,
  fetchEvents,
  fetchEnvironment,
  predictRisk,
  fetchHazardProgression,
} from './lib/apiClient';

export const App: React.FC = () => {
  // Top-level API queries
  const regionsQ = useApiResource(fetchRegions, []);
  const zonesQ = useApiResource(fetchRiskZones, []);
  const eventsQ = useApiResource(fetchEvents, []);
  const { health, loading: healthLoading, error: healthError } = useHealth(20000);

  // P0-B.2: Active alerts polling and manual refresh
  const { alerts, refresh: refreshAlerts } = useAlerts(20000);

  // Sidebar dynamic drag-to-resize on desktop
  const { width, isDesktop, onHandlePointerDown, resetWidth, nudge } = useSidebarResize();

  // Selection & View Mode state
  const mapViewRef = useRef<MapViewHandle>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'top' | 'focus'>('top');
  const [terrain3D, setTerrain3D] = useState<boolean>(false);

  // Hazard Progression Animation state
  const [hazardProgressionData, setHazardProgressionData] = useState<HazardProgressionResponse | null>(null);
  const [hazardStepIndex, setHazardStepIndex] = useState<number>(0);
  const [isHazardPlaying, setIsHazardPlaying] = useState<boolean>(false);
  const [showHazardCorridor, setShowHazardCorridor] = useState<boolean>(true);
  const [showHazardHistoricalMarker, setShowHazardHistoricalMarker] = useState<boolean>(true);

  const selectedZone = zonesQ.data?.find((z) => z.id === selectedZoneId) ?? null;

  // Detail queries for selected zone
  const envQ = useApiResource(
    () => fetchEnvironment(selectedZoneId!),
    [selectedZoneId],
    Boolean(selectedZoneId)
  );

  const zoneEventsQ = useApiResource(
    () => fetchEvents({ zone_id: selectedZoneId! }),
    [selectedZoneId],
    Boolean(selectedZoneId)
  );

  // P0-B.1: Baseline prediction query to fetch contributing_factors for the selected zone
  const baselinePredictQ = useApiResource(
    () => predictRisk({ zone_id: selectedZoneId! }),
    [selectedZoneId],
    Boolean(selectedZoneId)
  );

  // Phase 4 live rainfall scenario simulator hook
  const scenario = useScenario(selectedZone, envQ.data);

  // Refresh active alerts whenever a new prediction or simulation completes
  useEffect(() => {
    refreshAlerts();
  }, [scenario.simulation, baselinePredictQ.data, refreshAlerts]);

  // Derive display zones for MapView (selected zone polygon recolors when simulation is active)
  const displayZones = useMemo(
    () => applySimulationToZones(zonesQ.data ?? [], selectedZoneId ?? '', scenario.simulation),
    [zonesQ.data, selectedZoneId, scenario.simulation]
  );

  // Unified assessment passed to detail card
  const assessment = scenario.simulation
    ? {
        risk_score: scenario.simulation.risk_score,
        risk_level: scenario.simulation.risk_level,
        timestamp: scenario.simulation.timestamp,
      }
    : selectedZone
      ? {
        risk_score: selectedZone.risk_score,
        risk_level: selectedZone.risk_level,
        timestamp: selectedZone.timestamp,
      }
      : null;

  // Stable selection callbacks
  const handleSelectZone = useCallback((id: string) => {
    setSelectedZoneId(id);
  }, []);

  const handleDeselect = useCallback(() => {
    setSelectedZoneId(null);
    setMapViewMode('top');
    mapViewRef.current?.triggerTopView();
  }, []);

  const handleLaunchHazardProgression = useCallback(async (replayId: string) => {
    try {
      const data = await fetchHazardProgression(replayId);
      setHazardProgressionData(data);
      setHazardStepIndex(0);
      setIsHazardPlaying(true);
      setTerrain3D(true);
    } catch (err) {
      console.error('Failed to load hazard progression simulation:', err);
    }
  }, []);

  const handleCloseHazardProgression = useCallback(() => {
    setHazardProgressionData(null);
    setIsHazardPlaying(false);
    setHazardStepIndex(0);
  }, []);

  const [showShortcuts, setShowShortcuts] = useState(false);

  // Global Keyboard Shortcuts (Esc, 1-6, R, T, F, D, ?)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else if (hazardProgressionData) {
          handleCloseHazardProgression();
        } else if (selectedZoneId) {
          setSelectedZoneId(null);
          setMapViewMode('top');
          mapViewRef.current?.triggerTopView();
        }
      } else if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        setShowShortcuts((prev) => !prev);
      } else if (e.key === 't' || e.key === 'T') {
        mapViewRef.current?.triggerTopView();
      } else if (e.key === 'f' || e.key === 'F') {
        mapViewRef.current?.triggerFrontView();
      } else if (e.key === 'd' || e.key === 'D' || (e.altKey && e.key === '3')) {
        mapViewRef.current?.toggle3D();
      } else if ((e.key === 'r' || e.key === 'R') && scenario.isModified) {
        scenario.reset();
      } else if (/^[1-6]$/.test(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        const targetZone = zonesQ.data?.[index];
        if (targetZone) {
          setSelectedZoneId(targetZone.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showShortcuts, selectedZoneId, scenario, zonesQ.data, hazardProgressionData, handleCloseHazardProgression]);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Navigation / System Status Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        healthError={healthError}
        onOpenShortcuts={() => setShowShortcuts(true)}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutOverlay isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />

      {/* Main Full-Bleed Interactive Workspace */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* P0-B.2: Top-Floating Active Alerts Banner */}
        <AlertBanner alerts={alerts} onSelectZone={handleSelectZone} />

        {/* WebGL GIS Map Layer (recolors via displayZones prop) */}
        <MapErrorBoundary>
          <MapView
            ref={mapViewRef}
            regions={regionsQ.data}
            zones={displayZones}
            events={eventsQ.data}
            selectedZoneId={selectedZoneId}
            onSelectZone={handleSelectZone}
            mapViewMode={mapViewMode}
            onMapViewModeChange={setMapViewMode}
            sidebarWidth={isDesktop ? width : undefined}
            terrain3D={terrain3D}
            onTerrain3DChange={setTerrain3D}
            hazardProgressionData={hazardProgressionData}
            hazardStepIndex={hazardStepIndex}
            showHazardCorridor={showHazardCorridor}
            showHazardHistoricalMarker={showHazardHistoricalMarker}
          />
        </MapErrorBoundary>

        {/* Right-Floating Decision-Support & Scenario Simulation Panel */}
        <ZonePanel
          sidebarWidth={isDesktop ? width : undefined}
          isDesktop={isDesktop}
          onResizePointerDown={onHandlePointerDown}
          onResizeDoubleClick={resetWidth}
          onResizeNudge={nudge}
          zones={zonesQ.data}
          zonesLoading={zonesQ.loading}
          zonesError={zonesQ.error}
          selectedZone={selectedZone}
          assessment={assessment}
          simulation={scenario.simulation}
          baselinePrediction={baselinePredictQ.data}
          scenarioValues={scenario.values}
          setScenarioValues={scenario.setValues}
          simLoading={scenario.simLoading}
          simError={scenario.simError}
          isScenarioModified={scenario.isModified}
          scenarioAvailable={scenario.available}
          onResetScenario={scenario.reset}
          environment={envQ.data}
          envLoading={envQ.loading}
          envError={envQ.error}
          zoneEvents={zoneEventsQ.data}
          zoneEventsLoading={zoneEventsQ.loading}
          onSelectZone={handleSelectZone}
          onBackToList={handleDeselect}
          onRetryZones={zonesQ.reload}
          onRetryEnv={envQ.reload}
          mapViewMode={mapViewMode}
          onMapViewModeChange={setMapViewMode}
          terrain3D={terrain3D}
          onToggleTerrain={() => mapViewRef.current?.toggle3D()}
          onLaunchHazardProgression={handleLaunchHazardProgression}
        />

        {/* Floating Terrain-Aware Hazard Progression Replay Player */}
        {hazardProgressionData && (
          <HazardProgressionPlayer
            data={hazardProgressionData}
            currentStepIndex={hazardStepIndex}
            onStepChange={setHazardStepIndex}
            isPlaying={isHazardPlaying}
            onTogglePlay={() => setIsHazardPlaying((prev) => !prev)}
            onClose={handleCloseHazardProgression}
            showCorridor={showHazardCorridor}
            onToggleCorridor={() => setShowHazardCorridor((prev) => !prev)}
            showHistoricalMarker={showHazardHistoricalMarker}
            onToggleHistoricalMarker={() => setShowHazardHistoricalMarker((prev) => !prev)}
            terrain3D={terrain3D}
            onToggleTerrain3D={() => setTerrain3D((prev) => !prev)}
          />
        )}
      </main>
    </div>
  );
};

export default App;
