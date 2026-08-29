import React, { useState, useEffect, useCallback } from 'react';
import { CopilotResponse } from '../types/api';
import { askCopilot } from '../lib/apiClient';

interface CopilotPanelProps {
  zoneId: string;
}

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ zoneId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state on zone change
  useEffect(() => {
    setQuestion('');
    setAnswer(null);
    setError(null);
    setLoading(false);
  }, [zoneId]);

  const handleAsk = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      const trimmed = question.trim();
      if (trimmed.length < 5 || loading) return;

      setLoading(true);
      setError(null);

      try {
        const res = await askCopilot({
          zone_id: zoneId,
          question: trimmed,
        });
        setAnswer(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to consult Copilot');
      } finally {
        setLoading(false);
      }
    },
    [question, zoneId, loading]
  );

  return (
    <div className="pt-2 border-t border-slate-800/80">
      {/* Collapsible Header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between py-2 text-xs font-bold uppercase tracking-wider text-slate-300 hover:text-white transition cursor-pointer"
      >
        <span className="flex items-center gap-1.5">
          <span className="text-cyan-400">✦</span>
          <span>Ask SlopeGuard Copilot</span>
        </span>
        <span className="text-slate-400 text-xs font-mono">{isOpen ? '−' : '+'}</span>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <form onSubmit={handleAsk} className="space-y-2">
            <textarea
              rows={2}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Why is this zone at risk? or Tell me past events"
              className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition resize-none"
            />

            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">
                Grounded in current zone telemetry & events
              </span>

              <button
                type="submit"
                disabled={loading || question.trim().length < 5}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? 'Analyzing…' : 'Ask'}
              </button>
            </div>
          </form>

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-cyan-400/90 py-1">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Analyzing zone telemetry and historical events…</span>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
              {error}
            </div>
          )}

          {/* Answer Card */}
          {answer && !loading && (
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-300">Copilot Assessment</span>
                {answer.source === 'llm' ? (
                  <span className="px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-700/80 text-sky-300 text-[10px] font-bold tracking-wider uppercase">
                    AI
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono font-medium tracking-wider uppercase">
                    Offline mode
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-200 leading-relaxed">{answer.answer}</p>

              <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <span>Source: {answer.evidence.data_source}</span>
                <span>{new Date(answer.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
