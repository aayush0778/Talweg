import React, { useState, useCallback } from 'react';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { ZonePanel } from './components/ZonePanel';
import { MapErrorBoundary } from './components/MapErrorBoundary';
import { useApiResource } from './hooks/useApiResource';
import { useHealth } from './hooks/useHealth';
import { fetchRegions, fetchRiskZones, fetchEvents, fetchEnvironment } from './lib/apiClient';

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
        {/* WebGL GIS Map Layer */}
        <MapErrorBoundary>
          <MapView
            regions={regionsQ.data}
            zones={zonesQ.data}
            events={eventsQ.data}
            selectedZoneId={selectedZoneId}
            onSelectZone={handleSelectZone}
          />
        </MapErrorBoundary>

        {/* Right-Floating Decision-Support & Telemetry Panel */}
        <ZonePanel
          zones={zonesQ.data}
          zonesLoading={zonesQ.loading}
          zonesError={zonesQ.error}
          selectedZone={selectedZone}
          assessment={selectedZone} // Phase 4 simulator seam: pass simulated ?? selectedZone
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
