import React from 'react';
import { RiskZone, EnvironmentObservation, LandslideEvent, RiskLevel } from '../types/api';
import { ZoneList } from './ZoneList';
import { ZoneDetail } from './ZoneDetail';
import { StatusMessage } from './StatusMessage';

interface ZonePanelProps {
  zones: RiskZone[] | null;
  zonesLoading: boolean;
  zonesError: Error | null;
  selectedZone: RiskZone | null;
  assessment?: {
    risk_score: number | null;
    risk_level: RiskLevel | null;
    timestamp: string | null;
  } | null;
  environment: EnvironmentObservation | null;
  envLoading: boolean;
  envError: Error | null;
  zoneEvents: LandslideEvent[] | null;
  zoneEventsLoading: boolean;
  onSelectZone: (zoneId: string) => void;
  onBackToList: () => void;
  onRetryZones: () => void;
  onRetryEnv: () => void;
}

export const ZonePanel: React.FC<ZonePanelProps> = ({
  zones,
  zonesLoading,
  zonesError,
  selectedZone,
  assessment = null,
  environment,
  envLoading,
  envError,
  zoneEvents,
  zoneEventsLoading,
  onSelectZone,
  onBackToList,
  onRetryZones,
  onRetryEnv,
}) => {
  return (
    <aside className="absolute top-20 right-6 bottom-6 w-[400px] z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 shadow-2xl rounded-2xl flex flex-col overflow-hidden pointer-events-auto">
      {zonesLoading ? (
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <StatusMessage type="loading" title="Connecting to GIS Repository" message="Loading risk zones..." />
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
          environment={environment}
          envLoading={envLoading}
          envError={envError}
          events={zoneEvents}
          eventsLoading={zoneEventsLoading}
          onBack={onBackToList}
          onRetryEnv={onRetryEnv}
        />
      ) : zones && zones.length > 0 ? (
        <ZoneList zones={zones} selectedZoneId={null} onSelectZone={onSelectZone} />
      ) : (
        <div className="p-6 flex flex-col items-center justify-center h-full">
          <StatusMessage type="empty" message="No risk zones available for this region." />
        </div>
      )}
    </aside>
  );
};
