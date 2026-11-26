/** Formats an ISO timestamp as a short relative "time ago" string, or "never" for null. */
export function timeAgo(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'never';
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

/** Formats an ISO timestamp as a short local clock time, for chart axis ticks. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
