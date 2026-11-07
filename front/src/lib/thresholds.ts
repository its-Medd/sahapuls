/**
 * Mirrors the warning/alert cut lines in server/src/alerts/thresholds.ts.
 * These values are used here purely to draw reference guide lines on the
 * chart - the actual alert evaluation happens server-side against readings
 * as they're ingested; the frontend never re-derives alert state.
 */
export const DISPLAY_THRESHOLDS = {
  temperatureC: { warning: 35, alert: 45 },
  gasPpm: { warning: 150, alert: 400 },
  batteryPct: { warning: 20, alert: 10 },
} as const;
