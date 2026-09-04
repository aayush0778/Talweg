/**
 * Drag handle between the map and the right sidebar.
 * - Pointer drag to resize
 * - Double-click to reset to default width
 * - Keyboard accessible (ArrowLeft = wider, ArrowRight = narrower)
 * - Hidden below lg breakpoint via the isDesktop flag from the hook
 */

interface SidebarResizeHandleProps {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onDoubleClick: () => void;
  onNudge: (dx: number) => void;
}

export function SidebarResizeHandle({
  onPointerDown,
  onDoubleClick,
  onNudge,
}: SidebarResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize side panel (drag, or use arrow keys)"
      tabIndex={0}
      title="Drag to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          onNudge(24); // dragging left widens the right-docked panel
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          onNudge(-24);
        }
      }}
      className="sidebar-resize-handle"
    />
  );
}
