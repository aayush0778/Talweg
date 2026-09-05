import { type DataProvenance } from '../types/api';

const BADGE_STYLES: Record<DataProvenance, string> = {
  REAL: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  DERIVED: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  SYNTHETIC: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  SIMULATED: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
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
export function ProvenanceBadge({ type, note }: { type: DataProvenance; note?: string }) {
  return (
    <span
      title={note}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide cursor-default ${BADGE_STYLES[type]}`}
    >
      {BADGE_LABELS[type]}
    </span>
  );
}
