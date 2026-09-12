import React from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from 'react-router-dom';
import {
  LayoutDashboard,
  Map as MapIcon,
  Layers,
  FlaskConical,
  History,
  BellRing,
  Database,
  Cpu,
  Activity,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { MapWorkspacePage } from './pages/MapWorkspacePage';
import OverviewPage from './pages/OverviewPage';
import ZonesPage from './pages/ZonesPage';
import SimulationPage from './pages/SimulationPage';
import ReplayPage from './pages/ReplayPage';
import AlertsPage from './pages/AlertsPage';
import DataSourcesPage from './pages/DataSourcesPage';
import ModelPage from './pages/ModelPage';
import SystemHealthPage from './pages/SystemHealthPage';

/**
 * TALWEG Final Upgrade — application shell.
 *
 * Adds the disaster-management command-dashboard navigation (spec §20.1):
 * Overview · Live Risk Map · Zones · Simulation · Historical Replay ·
 * Alerts · Data & Sources · Model · System Health.
 *
 * The original map-first workspace is preserved verbatim under "Live Risk Map".
 */

const NAV_ITEMS = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/map', label: 'Live Risk Map', icon: MapIcon },
  { to: '/zones', label: 'Zones', icon: Layers },
  { to: '/simulation', label: 'Simulation', icon: FlaskConical },
  { to: '/replay', label: 'Historical Replay', icon: History },
  { to: '/alerts', label: 'Alerts', icon: BellRing },
  { to: '/data-sources', label: 'Data & Sources', icon: Database },
  { to: '/model', label: 'Model', icon: Cpu },
  { to: '/system-health', label: 'System Health', icon: Activity },
] as const;

const App: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
        {/* Top command bar */}
        <header className="h-14 md:h-16 px-4 md:px-6 bg-ink-900/95 backdrop-blur-md border-b border-line-subtle flex items-center gap-4 z-30 shrink-0">
          {/* Mark + wordmark */}
          <NavLink to="/overview" className="flex items-center gap-3 shrink-0" aria-label="Talweg home">
            <div
              className="w-8 h-8 rounded-md bg-ink-800 border border-line-strong flex items-center justify-center shrink-0 p-1"
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
              <span className="text-base font-bold font-sans tracking-tight text-paper-50 leading-none">Talweg</span>
              <span className="hidden sm:block text-[10px] font-mono text-paper-400 tracking-[0.08em] uppercase">
                LANDSLIDE RISK INTELLIGENCE · SIKKIM
              </span>
            </div>
          </NavLink>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex flex-1 items-center justify-end gap-1" aria-label="Main navigation">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] font-mono uppercase tracking-wider transition-colors border ${
                    isActive
                      ? 'bg-ink-800 text-paper-50 border-line-strong'
                      : 'text-paper-400 border-transparent hover:text-paper-200 hover:bg-ink-800/60'
                  }`
                }
              >
                <Icon size={13} aria-hidden="true" />
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Mobile nav toggle */}
          <button
            type="button"
            className="lg:hidden ml-auto p-2 rounded-sm text-paper-300 hover:bg-ink-800 border border-line-subtle"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </header>

        {/* Mobile navigation drawer */}
        {mobileNavOpen && (
          <nav
            className="lg:hidden absolute top-14 md:top-16 left-0 right-0 z-40 bg-ink-900 border-b border-line-subtle p-3 grid grid-cols-2 gap-1.5"
            aria-label="Mobile navigation"
          >
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                onClick={() => setMobileNavOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider border ${
                    isActive
                      ? 'bg-ink-800 text-paper-50 border-line-strong'
                      : 'text-paper-400 border-line-subtle hover:bg-ink-800/60'
                  }`
                }
              >
                <Icon size={14} aria-hidden="true" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        {/* Page content — scrollable dashboard surfaces; the map workspace fills its own area */}
        <main id="main-content" tabIndex={-1} className="flex-1 min-h-0 focus:outline-none">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<OverviewPage />} />
            <Route path="/map" element={<MapWorkspacePage />} />
            <Route path="/zones" element={<ZonesPage />} />
            <Route path="/simulation" element={<SimulationPage />} />
            <Route path="/replay" element={<ReplayPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/data-sources" element={<DataSourcesPage />} />
            <Route path="/model" element={<ModelPage />} />
            <Route path="/system-health" element={<SystemHealthPage />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
