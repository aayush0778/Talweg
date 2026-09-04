import React from 'react';

interface ShortcutOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  { key: '1 – 6', action: 'Select zone by position' },
  { key: 'Esc', action: 'Deselect zone / Close overlay' },
  { key: 'R', action: 'Reset scenario to baseline' },
  { key: '?', action: 'Toggle keyboard shortcuts help' },
];

export const ShortcutOverlay: React.FC<ShortcutOverlayProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-white">⌨️ Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs px-2 py-1 rounded bg-slate-800 border border-slate-700 transition cursor-pointer"
          >
            ESC
          </button>
        </div>

        <div className="space-y-2">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-1.5 border-b border-slate-800/60 last:border-0">
              <span className="text-xs text-slate-300">{s.action}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[11px] font-mono text-slate-300 font-medium">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <p className="text-[10px] text-slate-500 mt-4 text-center">
          Shortcuts work when no input field is focused
        </p>
      </div>
    </div>
  );
};
