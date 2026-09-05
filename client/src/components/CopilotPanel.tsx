/**
 * Copilot Panel — chat UI over POST /api/copilot
 *
 * KEY FIXES vs. the old behavior:
 * - Each submit sends the CURRENT input (no stale/hardcoded question)
 * - Response state updates per request (no cached/repeated answer)
 * - Conversation history renders user + assistant messages
 * - Engine badge shows whether the answer came from the LLM or the
 *   deterministic fallback (honesty + instant debugging)
 * - Suggestion chips demo the intents the fallback handles well
 *
 * NOTE: preserves this component's existing props/exports so parent imports
 * don't break.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../lib/apiClient';

type Engine = 'llm' | 'deterministic';

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  engine?: Engine;
}

interface CopilotPanelProps {
  zoneId?: string;
}

const GREETING =
  "Talweg Copilot — grounded in this prototype's live risk data. Ask about zone risk, rainfall, alerts, the 7-day outlook, or compare zones.";

const SUGGESTIONS = [
  'Why is this zone high risk?',
  'Show the most relevant historical event.',
  'Would TALWEG have flagged this event?',
  'Show me this terrain in 3D.',
];

const OFFLINE_TEXT =
  'I could not reach the server. Please check the backend connection and try again.';

let nextId = 1;

export const CopilotPanel: React.FC<CopilotPanelProps> = ({ zoneId }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, role: 'assistant', text: GREETING },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || isLoading) return;

      setInput('');
      setError(null);
      setMessages((prev) => [...prev, { id: nextId++, role: 'user', text: question }]);
      setIsLoading(true);

      try {
        const res = await fetch(`${API_BASE_URL}/api/copilot`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(import.meta.env.VITE_API_KEY ? { 'X-API-Key': import.meta.env.VITE_API_KEY } : {}),
          },
          cache: 'no-store', // never serve a cached response
          body: JSON.stringify({ question, zoneId }), // ← the CURRENT question, always
        });
        if (!res.ok) throw new Error(`Copilot request failed (${res.status})`);

        const data = (await res.json()) as { answer?: string; engine?: Engine };
        const answer = (data.answer ?? '').trim();
        if (!answer) throw new Error('Empty copilot response');

        setMessages((prev) => [
          ...prev,
          { id: nextId++, role: 'assistant', text: answer, engine: data.engine },
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMessages((prev) => [
          ...prev,
          { id: nextId++, role: 'assistant', text: OFFLINE_TEXT },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, zoneId]
  );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void ask(input);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <section
      aria-label="Talweg Copilot"
      className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3"
    >
      <header className="flex items-center justify-between pb-1 border-b border-slate-800/60">
        <div className="flex items-center gap-1.5">
          <span className="text-cyan-400">✦</span>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Talweg Copilot
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-slate-500 font-mono">
          Grounded · Prototype
        </span>
      </header>

      {/* Conversation Thread */}
      <div
        ref={listRef}
        className="space-y-2 overflow-y-auto pr-1 text-xs max-h-60 min-h-[140px] pt-1"
      >
        {messages.map((m) =>
          m.role === 'user' ? (
            <div
              key={m.id}
              className="ml-auto max-w-[85%] rounded-lg bg-cyan-600/90 px-3 py-2 text-white leading-relaxed"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[92%] rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-slate-200 leading-relaxed space-y-1"
            >
              <p>{m.text}</p>
              {m.engine && (
                <div className="pt-1 flex justify-end">
                  <span
                    className="inline-block rounded border border-slate-700 bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-mono uppercase text-slate-400"
                    title={
                      m.engine === 'llm'
                        ? 'Answered by configured LLM'
                        : 'Answered by deterministic rule engine (offline mode)'
                    }
                  >
                    {m.engine === 'llm' ? 'AI · LLM' : 'Offline mode'}
                  </span>
                </div>
              )}
            </div>
          )
        )}
        {isLoading && (
          <div className="max-w-[65%] rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-cyan-400/90 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span>Analyzing risk data…</span>
          </div>
        )}
      </div>

      {/* Suggestion Chips */}
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={isLoading}
              className="rounded-full border border-slate-700/80 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-300 transition hover:border-cyan-500 hover:text-cyan-300 disabled:opacity-50 text-left"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-amber-400">
          {error}
        </p>
      )}

      {/* Input */}
      <form onSubmit={onSubmit} className="flex gap-2 pt-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about zones, rainfall, alerts…"
          disabled={isLoading}
          aria-label="Ask the copilot a question"
          className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed"
        >
          Ask
        </button>
      </form>
    </section>
  );
};
