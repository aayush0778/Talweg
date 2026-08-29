import React from 'react';

interface StatusMessageProps {
  type?: 'loading' | 'error' | 'empty';
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  type = 'empty',
  title,
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`rounded-xl border p-5 text-center flex flex-col items-center justify-center space-y-3 ${
        type === 'error'
          ? 'bg-rose-950/40 border-rose-900/60 text-rose-200'
          : type === 'loading'
            ? 'bg-slate-900/60 border-slate-800 text-slate-300'
            : 'bg-slate-900/40 border-slate-800/80 text-slate-400'
      } ${className}`}
    >
      {type === 'loading' && (
        <div className="w-7 h-7 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      )}

      {type === 'error' && (
        <div className="w-8 h-8 rounded-full bg-rose-900/50 border border-rose-700/60 flex items-center justify-center text-rose-400 font-bold text-sm">
          !
        </div>
      )}

      <div>
        {title && <h4 className="font-semibold text-sm mb-1">{title}</h4>}
        <p className="text-xs leading-relaxed opacity-90 max-w-xs">{message}</p>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 rounded-lg border border-slate-700 transition cursor-pointer"
        >
          Retry Request
        </button>
      )}
    </div>
  );
};
