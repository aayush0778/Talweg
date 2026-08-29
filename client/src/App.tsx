import React, { useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { ZonePanel } from './components/ZonePanel';
import { MapErrorBoundary } from './components/MapErrorBoundary';
import { useApiResource } from './hooks/useApiResource';
import { useHealth } from './hooks/useHealth';
import { useScenario } from './hooks/useScenario';
import { applySimulationToZones } from './lib/scenario';
import {
  fetchRegions,
  fetchRiskZones,
  fetchEvents,
  fetchEnvironment,
  predictRisk,
} from './lib/apiClient';

export const App: React.FC = () => {
  // Top-level API queries
  const regionsQ = useApiResource(fetchRegions, []);
  const zonesQ = useApiResource(fetchRiskZones, []);
  const eventsQ = useApiResource(fetchEvents, []);
  const { health, loading: healthLoading, error: healthError } = useHealth(20000);

  // Selection state
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

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
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Navigation / System Status Header */}
      <Header health={health} healthLoading={healthLoading} healthError={healthError} />

      {/* Main Full-Bleed Interactive Workspace */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        {/* WebGL GIS Map Layer (recolors via displayZones prop) */}
        <MapErrorBoundary>
          <MapView
            regions={regionsQ.data}
            zones={displayZones}
            events={eventsQ.data}
            selectedZoneId={selectedZoneId}
            onSelectZone={handleSelectZone}
          />
        </MapErrorBoundary>

        {/* Right-Floating Decision-Support & Scenario Simulation Panel */}
        <ZonePanel
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
        />
      </main>
    </div>
  );
};

export default App;
