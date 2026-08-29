/**
 * Constructs DOM element for MapLibre event popups using DOM APIs and textContent ONLY.
 * Never uses innerHTML to prevent XSS vulnerabilities.
 */
export function buildEventPopup(props: Record<string, unknown>): HTMLElement {
  const container = document.createElement('div');
  container.className = 'p-3 text-slate-100 max-w-xs space-y-2';

  // Title / Date Header
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between border-b border-slate-700/60 pb-1.5 gap-2';

  const title = document.createElement('span');
  title.className = 'text-xs font-semibold uppercase tracking-wider text-rose-400';
  title.textContent = 'Landslide Event';

  const dateSpan = document.createElement('span');
  dateSpan.className = 'text-xs text-slate-400 font-mono';
  dateSpan.textContent = String(props.date || 'Unknown date');

  header.appendChild(title);
  header.appendChild(dateSpan);
  container.appendChild(header);

  // Trigger & Category Tags
  const tagRow = document.createElement('div');
  tagRow.className = 'flex flex-wrap gap-1.5';

  if (props.trigger) {
    const triggerBadge = document.createElement('span');
    triggerBadge.className =
      'px-1.5 py-0.5 text-[10px] font-medium bg-blue-950/80 text-blue-300 border border-blue-800/60 rounded';
    triggerBadge.textContent = `Trigger: ${String(props.trigger)}`;
    tagRow.appendChild(triggerBadge);
  }

  if (props.category) {
    const catBadge = document.createElement('span');
    catBadge.className =
      'px-1.5 py-0.5 text-[10px] font-medium bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded';
    catBadge.textContent = String(props.category);
    tagRow.appendChild(catBadge);
  }

  if (props.fatalities !== undefined && props.fatalities !== null && Number(props.fatalities) > 0) {
    const fatalBadge = document.createElement('span');
    fatalBadge.className =
      'px-1.5 py-0.5 text-[10px] font-medium bg-rose-950/80 text-rose-300 border border-rose-800/60 rounded';
    fatalBadge.textContent = `${props.fatalities} Fatalities`;
    tagRow.appendChild(fatalBadge);
  }

  if (tagRow.children.length > 0) {
    container.appendChild(tagRow);
  }

  // Description
  if (props.description) {
    const desc = document.createElement('p');
    desc.className = 'text-xs text-slate-300 leading-relaxed';
    desc.textContent = String(props.description);
    container.appendChild(desc);
  }

  // Provenance Footer
  const footer = document.createElement('div');
  footer.className = 'text-[10px] text-slate-500 pt-1 border-t border-slate-800/80 flex items-center justify-between';

  const src = document.createElement('span');
  src.textContent = `Source: ${String(props.source || 'unknown')}`;
  footer.appendChild(src);

  container.appendChild(footer);
  return container;
}
