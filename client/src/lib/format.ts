/**
 * Converts a 0.0 - 1.0 risk score to an integer percentage (0 - 100).
 * e.g., 0.508 -> 51
 */
export function scoreToPercent(score: number | null | undefined): number | null {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }
  return Math.round(score * 100);
}

/**
 * Formats an ISO observation timestamp to UTC representation.
 * e.g. "2026-08-01T06:00:00.000Z" -> "2026-08-01 06:00 UTC"
 */
export function formatObsTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'No data';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid date';

    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    const h = String(d.getUTCHours()).padStart(2, '0');
    const min = String(d.getUTCMinutes()).padStart(2, '0');

    return `${y}-${m}-${day} ${h}:${min} UTC`;
  } catch {
    return 'Invalid date';
  }
}

/**
 * Formats an event date string (YYYY-MM-DD) for clean display.
 */
export function formatEventDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Unknown date';
  return dateStr;
}
