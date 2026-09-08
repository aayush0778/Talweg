import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
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
  'Why is this corridor high risk?',
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
          cache: 'no-store',
          body: JSON.stringify({ question, zoneId }),
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
      className="flex flex-col gap-2 rounded-xl border border-glacier-600/55 bg-glacier-700/12 p-3 text-glacier-300"
    >
      <header className="flex items-center justify-between pb-1.5 border-b border-glacier-600/30">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-glacier-400" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-paper-50 uppercase tracking-wider">
            Talweg Copilot
          </h3>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-glacier-400/80 font-mono">
          Grounded Intelligence
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
              className="ml-auto max-w-[85%] rounded-lg bg-ink-800 border border-line-subtle px-3 py-2 text-paper-50 leading-relaxed"
            >
              {m.text}
            </div>
          ) : (
            <div
              key={m.id}
              className="max-w-[92%] rounded-lg border border-glacier-600/40 bg-glacier-700/18 px-3 py-2 text-paper-100 leading-relaxed space-y-1"
            >
              <p>{m.text}</p>
              {m.engine && (
                <div className="pt-1 flex justify-end">
                  <span
                    className="inline-block rounded border border-glacier-600/30 bg-ink-950/60 px-1.5 py-0.5 text-[9px] font-mono uppercase text-glacier-300"
                    title={
                      m.engine === 'llm'
                        ? 'Answered by configured LLM'
                        : 'Answered by deterministic rule engine (offline mode)'
                    }
                  >
                    {m.engine === 'llm' ? 'AI · LLM' : 'Deterministic fallback'}
                  </span>
                </div>
              )}
            </div>
          )
        )}
        {isLoading && (
          <div
            className="max-w-[70%] rounded-lg border border-glacier-600/40 bg-glacier-700/18 px-3 py-2 text-glacier-300 flex items-center gap-2"
            aria-live="polite"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-glacier-400 animate-ping" />
            <span>Analyzing corridor telemetry…</span>
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
              className="rounded-full border border-glacier-600/40 bg-glacier-700/15 px-2.5 py-1 text-[11px] text-glacier-200 transition hover:bg-glacier-700/25 hover:text-paper-50 disabled:opacity-50 text-left cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-risk-severe">
          {error}
        </p>
      )}

      {/* Input */}
      <form onSubmit={onSubmit} className="flex gap-2 pt-1">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about corridors, rainfall, alerts…"
          disabled={isLoading}
          aria-label="Ask the copilot a question"
          className="min-w-0 flex-1 rounded-md border border-line-strong bg-ink-950 px-3 py-1.5 min-h-[36px] sm:min-h-0 text-xs text-paper-100 placeholder:text-paper-400 focus:border-glacier-400 focus:ring-1 focus:ring-glacier-400/40 focus:outline-none disabled:opacity-50 transition"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="rounded-md bg-glacier-500 hover:bg-glacier-400 px-3 py-1.5 text-xs font-semibold text-ink-950 transition disabled:bg-ink-800 disabled:text-paper-400 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1 shrink-0"
        >
          <span>Ask</span>
          <Send className="w-3 h-3" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
};
