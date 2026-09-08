import { type DataProvenance } from '../types/api';

const BADGE_STYLES: Record<DataProvenance, string> = {
  REAL: 'text-monsoon-300 border-monsoon-500/60 bg-monsoon-500/12',
  DERIVED: 'text-silt-300 border-silt-500/60 bg-silt-500/12',
  SYNTHETIC: 'text-paper-200 border-line-strong bg-ink-800',
  SIMULATED: 'bg-silt-500/20 text-silt-300 border-silt-400/50',
};

const BADGE_LABELS: Record<DataProvenance, string> = {
  REAL: 'Real',
  DERIVED: 'Derived',
  SYNTHETIC: 'Synthetic',
  SIMULATED: 'Simulated',
};

/**
 * ProvenanceBadge — displays the provenance classification of a data value.
 * Used across Historical Replay, Zone Details, and Data Source panels
 * to maintain scientific honesty and transparency.
 */
export function ProvenanceBadge({
  type,
  note,
  className = '',
}: {
  type: DataProvenance;
  note?: string;
  className?: string;
}) {
  return (
    <span
      title={note}
      className={`inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wide cursor-default ${BADGE_STYLES[type]} ${className}`}
    >
      {BADGE_LABELS[type]}
    </span>
  );
}

