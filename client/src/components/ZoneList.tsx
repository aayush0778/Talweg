import React from 'react';
import { RiskZone } from '../types/api';
import { RiskBadge } from './RiskBadge';

interface ZoneListProps {
  zones: RiskZone[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
}

export const ZoneList: React.FC<ZoneListProps> = ({ zones, selectedZoneId, onSelectZone }) => {
  return (
    <div className="flex flex-col h-full bg-ink-900 text-paper-100">
      <div className="p-3.5 border-b border-line-subtle flex items-center justify-between">
        <div>
          <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300">
            Monitored Corridors
          </h2>
          <p className="text-[11px] text-paper-400 mt-0.5">
            Ranked Himalayan transit and municipal corridors
          </p>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-ink-800 border border-line-subtle text-paper-300">
          {zones.length} CORRIDORS
        </span>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-line-subtle" role="list">
        {zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const score = (zone.risk_score ?? 0).toFixed(2);

          return (
            <div
              key={zone.id}
              role="button"
              tabIndex={0}
              aria-selected={isSelected}
              onClick={() => onSelectZone(zone.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectZone(zone.id);
                }
              }}
              className={`p-3 transition-colors cursor-pointer focus-ring outline-none select-none ${
                isSelected
                  ? 'bg-lichen-700/15 border-l-2 border-lichen-400 text-paper-50'
                  : 'bg-ink-900/40 hover:bg-ink-800/60 border-l-2 border-transparent text-paper-200'
              }`}
            >
              {/* Desktop 3-column layout / Mobile 2-row layout */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-semibold text-paper-100 truncate tracking-tight">
                      {zone.name}
                    </h3>
                  </div>
                  {zone.base_slope && (
                    <span className="text-[10px] font-mono text-paper-400">
                      Slope: {zone.base_slope}° base
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <RiskBadge level={zone.risk_level} />
                  <span className="text-xs font-mono font-bold text-paper-100 w-10 text-right tabular-nums">
                    {score}
                  </span>
                </div>
              </div>

              {zone.description && (
                <p className="text-[11px] text-paper-400 line-clamp-1 mt-1 leading-normal">
                  {zone.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
