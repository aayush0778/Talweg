import React from 'react';
import { Camera, Mountain, Check, TriangleAlert, Activity, X } from 'lucide-react';

interface EvidencePanelProps {
  eventId: string;
  onClose?: () => void;
}

export const HistoricalEvidencePanel: React.FC<EvidencePanelProps> = ({ eventId, onClose }) => {
  return (
    <div className="p-4 rounded-lg bg-ink-950 border border-line-strong shadow-lg space-y-3 relative text-paper-200">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-paper-400 hover:text-paper-100 p-1"
          aria-label="Close evidence panel"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      )}
      <div className="flex items-center justify-between border-b border-line-subtle pb-2">
        <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-300 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5 text-paper-400" aria-hidden="true" />
          <span>Historical Evidence Record</span>
          <span className="text-[10px] font-mono text-paper-400 font-normal">#{eventId}</span>
        </h3>
      </div>

      <div className="rounded-md border border-line-subtle bg-ink-900/60 p-4 text-center">
        <div className="w-full h-24 bg-ink-950 rounded border border-line-subtle flex items-center justify-center mb-3 text-paper-400">
          <Mountain className="w-8 h-8 opacity-30" aria-hidden="true" />
        </div>

        <p className="text-xs text-paper-400 leading-relaxed max-w-xs mx-auto">
          No verified raster evidence uploaded for this event. Ground photographs or Sentinel-2 imagery can be ingested via the verification pipeline.
        </p>
      </div>

      <div className="text-[10px] text-paper-400 flex items-center justify-center gap-3 pt-1 font-mono">
        <span className="flex items-center gap-1 text-lichen-400">
          <Check className="w-3 h-3" aria-hidden="true" /> Verified
        </span>
        <span className="text-line-strong">|</span>
        <span className="flex items-center gap-1 text-silt-300">
          <TriangleAlert className="w-3 h-3" aria-hidden="true" /> Reference
        </span>
        <span className="text-line-strong">|</span>
        <span className="flex items-center gap-1 text-paper-400">
          <Activity className="w-3 h-3" aria-hidden="true" /> Simulation
        </span>
      </div>
    </div>
  );
};
