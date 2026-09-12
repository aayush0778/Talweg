import React from 'react';
import { ComponentStatus } from '../../types/api';

/** Shared page chrome: title, description, and an optional right-side slot. */
export const PageShell: React.FC<{
  title: string;
  description: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ title, description, children, actions }) => (
  <div className="h-full overflow-y-auto bg-ink-950">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg md:text-xl font-bold font-sans tracking-tight text-paper-50">{title}</h1>
          <p className="text-xs font-mono text-paper-400 tracking-wide mt-1 max-w-3xl">{description}</p>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  </div>
);

export const KpiCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'high' | 'severe' | 'good' | 'warn';
  icon?: React.ReactNode;
}> = ({ label, value, sub, tone = 'default', icon }) => {
  const toneClass =
    tone === 'severe'
      ? 'text-[#ef7070]'
      : tone === 'high'
        ? 'text-[#e49a62]'
        : tone === 'good'
          ? 'text-[#79c8a5]'
          : tone === 'warn'
            ? 'text-[#d8c56a]'
            : 'text-paper-50';
  return (
    <div className="bg-ink-900 border border-line-subtle rounded-md p-3.5 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-paper-400">{label}</span>
        {icon && <span className="text-paper-400" aria-hidden="true">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold font-sans tabular-nums leading-none ${toneClass}`}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-paper-400">{sub}</span>}
    </div>
  );
};

export const StatusPill: React.FC<{ status: ComponentStatus | string; className?: string }> = ({ status, className = '' }) => {
  const s = status.toUpperCase();
  const cls =
    s === 'HEALTHY' || s === 'LIVE' || s === 'OK'
      ? 'text-[#79c8a5] border-[#79c8a5]/40 bg-[#79c8a5]/10'
      : s === 'PARTIAL' || s === 'RECENT' || s === 'DERIVED'
        ? 'text-[#d8c56a] border-[#d8c56a]/40 bg-[#d8c56a]/10'
        : s === 'DEGRADED'
          ? 'text-[#e49a62] border-[#e49a62]/40 bg-[#e49a62]/10'
          : s === 'SYNTHETIC'
            ? 'text-[#b5a0e6] border-[#b5a0e6]/40 bg-[#b5a0e6]/10'
            : s === 'HISTORICAL'
              ? 'text-paper-300 border-line-strong bg-ink-800'
              : 'text-[#ef7070] border-[#ef7070]/40 bg-[#ef7070]/10';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border ${cls} ${className}`}>
      {status}
    </span>
  );
};

export const ModelModeBadge: React.FC<{ mode: string | null | undefined; className?: string }> = ({ mode, className = '' }) => {
  const label =
    mode === 'hybrid_prototype'
      ? 'Hybrid Prototype'
      : mode === 'empirical_model'
        ? 'Empirical Model'
        : mode === 'synthetic_surrogate'
          ? 'Synthetic Surrogate'
          : 'Model Mode N/A';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 ${className}`}>
      {label}
    </span>
  );
};

/** Risk Index display — explicitly NOT a probability (spec §12). */
export const RiskIndex: React.FC<{ score: number | null | undefined; size?: 'sm' | 'lg' }> = ({ score, size = 'sm' }) => {
  if (score === null || score === undefined) {
    return <span className="font-mono text-paper-400">—</span>;
  }
  return (
    <span className={`font-mono tabular-nums ${size === 'lg' ? 'text-3xl font-bold' : 'text-sm font-semibold'}`}>
      {Math.round(score * 100)}
      <span className="text-paper-400 text-[0.7em]">/100</span>
    </span>
  );
};

export const LoadingBlock: React.FC<{ label?: string }> = ({ label = 'Loading…' }) => (
  <div className="bg-ink-900 border border-line-subtle rounded-md p-6 text-center">
    <span className="text-xs font-mono text-paper-400 animate-pulse">{label}</span>
  </div>
);

export const ErrorBlock: React.FC<{ message: string; onRetry?: () => void }> = ({ message, onRetry }) => (
  <div className="bg-ink-900 border border-[#ef7070]/30 rounded-md p-6 text-center space-y-2">
    <p className="text-xs font-mono text-[#ef7070]">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider border border-line-strong bg-ink-800 text-paper-200 hover:bg-ink-700"
      >
        Retry
      </button>
    )}
  </div>
);
