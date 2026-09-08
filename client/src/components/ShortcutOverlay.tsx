import React, { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '1 – 6', action: 'Select corridor by index' },
  { key: 'Esc', action: 'Deselect corridor / Close modal' },
  { key: 'T', action: 'Top View (Sikkim Nadir 0° Overview)' },
  { key: 'F', action: 'Focus View (Zoom to corridor centroid)' },
  { key: 'D', action: '3D Terrain (Toggle elevation relief)' },
  { key: 'R', action: 'Reset what-if scenario to observed' },
  { key: '?', action: 'Toggle keyboard shortcuts reference' },
];

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div
        className="bg-ink-950 border border-line-strong rounded-lg shadow-drawer p-6 max-w-sm w-full mx-4 text-paper-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 border-b border-line-subtle pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-lichen-400" aria-hidden="true" />
            <h2 className="text-xs font-mono font-semibold uppercase tracking-wider text-paper-100">
              Keyboard Navigation
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-paper-400 hover:text-paper-100 p-1 rounded hover:bg-ink-800 transition cursor-pointer"
            aria-label="Close shortcuts dialog"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between py-1.5 border-b border-line-subtle last:border-0"
            >
              <span className="text-xs text-paper-300">{s.action}</span>
              <kbd className="px-2 py-0.5 rounded bg-ink-900 border border-line-subtle text-[11px] font-mono text-paper-200 font-medium">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-paper-400 mt-4 text-center font-mono">
          Shortcuts active when no form control is focused
        </p>
      </div>
    </div>
  );
};
