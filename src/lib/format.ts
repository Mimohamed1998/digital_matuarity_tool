/**
 * Display formatting. Kept out of the scoring engine on purpose — the engine keeps full
 * precision and formatting is a presentation concern (docs/plan.md §3.3).
 */

/** Format a score to a fixed number of decimal places, e.g. 3.8021 → "3.80". */
export function formatScore(value: number, decimals = 2): string {
  return value.toFixed(decimals);
}

/** Format a weight as a percentage, e.g. 0.383 → "38.3%". */
export function formatWeight(weight: number, decimals = 1): string {
  return `${(weight * 100).toFixed(decimals)}%`;
}

/** Format an ISO timestamp for display, e.g. "22 Aug 2026, 09:31". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

/** Format a duration in milliseconds as a compact human string, e.g. "3m 04s". */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${String(seconds).padStart(2, '0')}s` : `${seconds}s`;
}
