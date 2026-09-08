import React, { useState } from 'react';
import { CircleAlert, Info, RefreshCw } from 'lucide-react';

export interface PanelStateProps {
  title?: string;
  message?: string;
  description?: string;
  onRetry?: () => void | Promise<void>;
  className?: string;
}

export const PanelLoading: React.FC<PanelStateProps> = ({
  title,
  message,
  description,
  className = '',
}) => {
  return (
    <div
      role="status"
      aria-busy="true"
      className={`p-4 rounded-md surface-inset text-center flex flex-col items-center justify-center space-y-2.5 ${className}`}
    >
      <div className="flex items-center gap-2 text-lichen-400 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
        <span>{title || message || ""}</span>
      </div>
      {description && (
        <p className="text-xs text-paper-400 max-w-xs leading-relaxed font-sans">
          {description}
        </p>
      )}
    </div>
  );
};

export const PanelEmpty: React.FC<PanelStateProps> = ({
  title,
  message,
  description,
  className = '',
}) => {
  return (
    <div
      role="status"
      className={`p-4 rounded-md surface-inset text-center flex flex-col items-center justify-center space-y-2 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-paper-300 text-xs font-medium">
        <Info className="w-4 h-4 text-paper-400" aria-hidden="true" />
        <span>{title || message || ""}</span>
      </div>
      {description && (
        <p className="text-xs text-paper-400 max-w-xs leading-relaxed font-sans">
          {description}
        </p>
      )}
    </div>
  );
};

export const PanelError: React.FC<PanelStateProps> = ({
  title,
  message,
  description,
  onRetry,
  className = '',
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry || isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      role="alert"
      className={`p-4 rounded-md bg-risk-severe-bg/40 border border-risk-severe/40 text-center flex flex-col items-center justify-center space-y-2.5 ${className}`}
    >
      <div className="flex items-center gap-1.5 text-risk-severe text-xs font-semibold">
        <CircleAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
        <span>{title || message || ""}</span>
      </div>
      {description && (
        <p className="text-xs text-paper-200/90 max-w-xs leading-relaxed font-sans">
          {description}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={handleRetry}
          disabled={isRetrying}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-ink-800 hover:bg-ink-750 text-paper-100 border border-line-strong transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
          <span>{isRetrying ? 'Retrying…' : 'Retry'}</span>
        </button>
      )}
    </div>
  );
};

export const InlineRetry: React.FC<{
  message?: string;
  onRetry: () => void | Promise<void>;
  className?: string;
}> = ({ message = 'Request failed', onRetry, className = '' }) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 text-xs text-paper-300 ${className}`}>
      <span>{message}</span>
      <button
        type="button"
        onClick={handleRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1 text-lichen-400 hover:text-lichen-300 transition cursor-pointer disabled:opacity-50 underline focus-ring"
      >
        <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} aria-hidden="true" />
        <span>Retry</span>
      </button>
    </div>
  );
};

export const SectionHeader: React.FC<{
  title: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  eyebrowText?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}> = ({ title, icon: Icon, eyebrowText, badge, children, className = '' }) => {
  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-paper-400 shrink-0" aria-hidden="true" />}
        <div className="min-w-0">
          {eyebrowText && <div className="eyebrow truncate">{eyebrowText}</div>}
          <h3 className="text-xs font-semibold uppercase tracking-wider text-paper-200 truncate">
            {title}
          </h3>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {badge}
        {children}
      </div>
    </div>
  );
};
