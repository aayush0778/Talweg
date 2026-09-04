/**
 * Sidebar Resize Hook
 *
 * Provides drag-to-resize for the right-docked sidebar panel.
 * - Width persisted to localStorage (survives refresh)
 * - Clamped so the map never becomes unusable
 * - Active drag disables map pointer events + text selection via body class
 * - Desktop-only: below lg breakpoint, callers should ignore the width
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'talweg:sidebar-width';
const DEFAULT_WIDTH = 400;
const MIN_WIDTH = 320;
const MAX_WIDTH = 760;
const MIN_MAP_WIDTH = 380; // map must always keep at least this much space

function clampWidth(w: number): number {
  const maxByViewport = window.innerWidth - MIN_MAP_WIDTH;
  const max = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, maxByViewport));
  return Math.round(Math.min(Math.max(w, MIN_WIDTH), max));
}

function getInitialWidth(): number {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const n = Number.parseInt(stored, 10);
      if (Number.isFinite(n) && n >= MIN_WIDTH) return clampWidth(n);
    }
  } catch {
    /* localStorage unavailable — ignore */
  }
  return DEFAULT_WIDTH;
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
}

export function useSidebarResize() {
  const isDesktop = useIsDesktop();
  const [width, setWidth] = useState<number>(getInitialWidth);
  const [isResizing, setIsResizing] = useState(false);
  const dragRef = useRef({ startX: 0, startWidth: DEFAULT_WIDTH });

  /** Panel is docked RIGHT: dragging left (clientX shrinks) widens the panel. */
  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };
      setIsResizing(true);
    },
    [width]
  );

  useEffect(() => {
    if (!isResizing) return;

    const onPointerMove = (e: PointerEvent) => {
      const delta = dragRef.current.startX - e.clientX;
      setWidth(clampWidth(dragRef.current.startWidth + delta));
    };
    const endDrag = () => setIsResizing(false);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endDrag(); // keeps the width reached so far
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('keydown', onKeyDown);
    // Body class: global col-resize cursor, kills text selection,
    // and (critically) disables MapLibre canvas pointer events during drag.
    document.body.classList.add('is-resizing-sidebar');

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
      window.removeEventListener('keydown', onKeyDown);
      document.body.classList.remove('is-resizing-sidebar');
    };
  }, [isResizing]);

  // Persist width
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

  // Re-clamp when the viewport changes
  useEffect(() => {
    const onWindowResize = () => setWidth((w) => clampWidth(w));
    window.addEventListener('resize', onWindowResize);
    return () => window.removeEventListener('resize', onWindowResize);
  }, []);

  const resetWidth = useCallback(() => setWidth(clampWidth(DEFAULT_WIDTH)), []);
  /** Positive dx = wider panel. */
  const nudge = useCallback((dx: number) => setWidth((w) => clampWidth(w + dx)), []);

  return { width, isResizing, isDesktop, onHandlePointerDown, resetWidth, nudge };
}
