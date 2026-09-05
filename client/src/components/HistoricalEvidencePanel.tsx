import React from 'react';

interface EvidencePanelProps {
  eventId: string;
  onClose?: () => void;
}

export const HistoricalEvidencePanel: React.FC<EvidencePanelProps> = ({ eventId, onClose }) => {
  return (
    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 shadow-lg space-y-3.5 relative">
      {onClose && (
        <button 
          onClick={onClose}
          className="absolute top-3 right-3 text-slate-500 hover:text-slate-300"
          aria-label="Close"
        >
          ✕
        </button>
      )}
      <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
          📸 Historical Evidence <span className="text-[10px] font-mono text-slate-400 font-normal">#{eventId}</span>
        </h3>
      </div>
      
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center">
        <div className="w-full h-32 bg-slate-800/50 rounded-lg border border-slate-700/50 flex items-center justify-center mb-3 overflow-hidden">
           <span className="text-4xl opacity-20">🏔️</span>
        </div>
        
        <p className="text-xs text-slate-400 leading-relaxed max-w-xs mx-auto">
          No verified evidence available for this event. Evidence can be added via the data ingestion pipeline.
        </p>
      </div>

      <div className="text-[10px] text-slate-500 flex items-center justify-center gap-2 pt-1">
        <span className="flex items-center gap-1"><span className="text-emerald-500">✓</span> Verified</span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1"><span className="text-amber-500">⚠</span> Reference Imagery</span>
        <span className="text-slate-700">|</span>
        <span className="flex items-center gap-1"><span className="text-purple-500">⟁</span> Simulation</span>
      </div>
    </div>
  );
};
