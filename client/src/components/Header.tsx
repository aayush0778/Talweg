import React, { useState } from 'react';
import { HealthResponse } from '../types/api';
import { DataSourcePanel } from './DataSourcePanel';
import { Keyboard, Activity, Menu, X } from 'lucide-react';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  healthError: Error | null;
  onOpenShortcuts?: () => void;
  /**
   * Embedded inside the dashboard shell (which already renders the Talweg
   * brand + navigation): hides the brand block and renders a slim status row.
   */
  embedded?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  healthLoading,
  healthError,
  onOpenShortcuts,
  embedded = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Lifted so the header can rise above the zone sidebar while the
  // pipeline panel is open (the panel would otherwise paint behind it).
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const isOk = health?.status === 'ok' && health?.database === 'connected';

  return (
    <>
      {/* Accessible skip link for keyboard navigation */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-lichen-600 focus:text-paper-50 focus:rounded-md focus:shadow-focus"
      >
        Skip to main content
      </a>

      <header
        className={`${
          embedded
            ? 'h-11 border-t border-line-subtle'
            : 'h-14 md:h-16'
        } px-4 md:px-6 bg-ink-900/95 backdrop-blur-md border-b border-line-subtle flex items-center justify-between ${
          pipelineOpen ? 'z-[60]' : 'z-20'
        } shrink-0 transition-[height]`}
      >
        {/* Left: Geometric mark + Wordmark (hidden in embedded mode — the shell owns branding) */}
        {!embedded && (
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md bg-ink-800 border border-line-strong flex items-center justify-center shrink-0 p-1"
            title="Talweg Contour Mark"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="w-full h-full" fill="none">
              <path d="M 3 19 C 7 17, 13 20, 21 16" stroke="#5d7b2c" strokeWidth="2" strokeLinecap="round" />
              <path d="M 3 13 C 8 11, 12 14, 21 10" stroke="#789b35" strokeWidth="2" strokeLinecap="round" />
              <path d="M 4 7 C 9 5, 12 8, 19 4" stroke="#9fbe4e" strokeWidth="2" strokeLinecap="round" />
              <circle cx="17" cy="4" r="1.5" fill="#b5a0e6" />
            </svg>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold font-sans tracking-tight text-paper-50">
                Talweg
              </span>
              <span className="text-[10px] font-mono font-medium tracking-wider uppercase px-1.5 py-0.5 rounded-sm bg-ink-800 text-paper-300 border border-line-strong">
                SIH 2026
              </span>
            </div>
            <p className="hidden sm:block text-[11px] font-mono text-paper-400 tracking-[0.08em] uppercase">
              LANDSLIDE RISK INTELLIGENCE · SIKKIM
            </p>
          </div>
        </div>
        )}
        {embedded && <div className="flex items-center gap-2 text-[10px] font-mono text-paper-400 tracking-[0.08em] uppercase">
          <span className="hidden sm:inline">MAP WORKSPACE</span>
        </div>}

        {/* Desktop Header Actions */}
        <div className="hidden md:flex items-center space-x-3">
          {/* Keyboard Shortcuts Trigger */}
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={onOpenShortcuts}
              aria-label="View Keyboard Shortcuts"
              className="flex items-center gap-1.5 px-3 min-h-[40px] rounded-md bg-ink-800 hover:bg-ink-750 text-paper-200 hover:text-paper-50 border border-line-subtle text-xs font-medium transition cursor-pointer focus-ring"
              title="View Keyboard Shortcuts (?)"
            >
              <Keyboard className="w-4 h-4 text-paper-400" aria-hidden="true" />
              <span>Shortcuts</span>
            </button>
          )}

          {/* Interactive Data Source & Pipeline Dashboard */}
          <DataSourcePanel health={health} onOpenChange={setPipelineOpen} />

          {/* Live System Health Badge */}
          <div
            className={`flex items-center gap-2 px-3 min-h-[40px] rounded-md border text-xs font-mono transition-colors ${
              healthLoading && !health
                ? 'bg-ink-850 border-line-subtle text-paper-400'
                : isOk && !healthError
                  ? 'bg-ink-850 border-line-subtle text-paper-200'
                  : 'bg-risk-moderate-bg/40 border-risk-moderate/40 text-risk-moderate'
            }`}
            title={
              isOk
                ? `Connected to PostgreSQL with PostGIS ${health?.postgis || '3.x'}`
                : healthError?.message || 'Database connection degraded'
            }
          >
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                healthLoading && !health
                  ? 'bg-paper-400 animate-pulse'
                  : isOk && !healthError
                    ? 'bg-risk-low'
                    : 'bg-risk-moderate'
              }`}
              aria-hidden="true"
            />
            <Activity className="w-3.5 h-3.5 text-paper-400" aria-hidden="true" />
            <span className="text-[11px]">
              {healthLoading && !health
                ? 'Connecting…'
                : isOk && !healthError
                  ? 'PostgreSQL · PostGIS'
                  : 'Degraded'}
            </span>
          </div>
        </div>

        {/* Mobile Header Menu Button */}
        <div className="flex items-center md:hidden gap-2">
          <DataSourcePanel health={health} onOpenChange={setPipelineOpen} />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close header menu' : 'Open header menu'}
            className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-md bg-ink-800 text-paper-200 hover:text-paper-50 border border-line-subtle focus-ring"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Menu for Secondary Actions */}
      {mobileMenuOpen && (
        <div className="md:hidden z-30 bg-ink-900/98 border-b border-line-strong p-4 space-y-3">
          {onOpenShortcuts && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenShortcuts();
              }}
              className="w-full flex items-center justify-between p-2.5 rounded-md bg-ink-800 text-paper-200 text-xs font-medium border border-line-subtle focus-ring"
            >
              <div className="flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-paper-400" aria-hidden="true" />
                <span>Keyboard Shortcuts</span>
              </div>
              <span className="font-mono text-paper-400">?</span>
            </button>
          )}

          <div className="flex items-center justify-between p-2.5 rounded-md bg-ink-800 border border-line-subtle text-xs font-mono text-paper-300">
            <span>Database Status:</span>
            <span className={isOk ? 'text-risk-low' : 'text-risk-moderate'}>
              {isOk ? 'PostgreSQL Active' : 'Degraded'}
            </span>
          </div>
        </div>
      )}
    </>
  );
};

