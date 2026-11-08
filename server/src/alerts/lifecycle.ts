import { DEFAULT_THRESHOLDS, evaluateThresholds, type Thresholds } from './thresholds.js';
import type { DashboardDatabase } from '../db/database.js';
import type { AlertRecord, MetricName, RuleBreach, Severity, TelemetryReading } from '../types.js';

export const ALERT_COOLDOWN_MS = 60_000;
export const HYSTERESIS: Record<MetricName, number> = {
  temperatureC: 2,
  gasPpm: 20,
  batteryPct: 2,
  soilMoisturePct: 3,
  waterLevelCm: 3,
};
export const METRIC_RULES: Record<
  MetricName,
  { warning: keyof Thresholds; alert: keyof Thresholds; lower: boolean }
> = {
  temperatureC: { warning: 'temperatureWarningC', alert: 'temperatureAlertC', lower: false },
  gasPpm: { warning: 'gasWarningPpm', alert: 'gasAlertPpm', lower: false },
  batteryPct: { warning: 'batteryWarningPct', alert: 'batteryAlertPct', lower: true },
  soilMoisturePct: { warning: 'soilWarningPct', alert: 'soilAlertPct', lower: true },
  waterLevelCm: { warning: 'waterWarningCm', alert: 'waterAlertCm', lower: true },
};

/** Called inside the ingest transaction. Missing legacy sensor values cannot resolve alerts. */
export function transitionAlerts(
  db: DashboardDatabase,
  reading: TelemetryReading,
  thresholds = DEFAULT_THRESHOLDS,
): { changes: AlertRecord[]; severity: Severity } {
  const breaches = evaluateThresholds(reading, thresholds).breaches;
  const changes: AlertRecord[] = [];
  let severity: Severity = 'normal';
  for (const metric of Object.keys(METRIC_RULES) as MetricName[]) {
    const value = reading[metric];
    const history = db.getMetricAlerts(reading.nodeId, metric);
    const active = history.filter((a) => a.state !== 'RESOLVED');
    const rule = METRIC_RULES[metric];
    let breach: RuleBreach | undefined = breaches.find((b) => b.metric === metric);
    for (const alert of active) {
      if (value == null) {
        if (alert.severity === 'alert' || severity === 'normal') severity = alert.severity;
        continue;
      }
      const recovered = rule.lower
        ? value >= thresholds[rule.warning] + HYSTERESIS[metric]
        : value <= thresholds[rule.warning] - HYSTERESIS[metric];
      if (recovered) {
        changes.push(
          db.updateAlert(alert.id, { ...alert, value, state: 'RESOLVED' }, reading.ts, 'RESOLVE'),
        );
        continue;
      }
      // Hold the critical band until it clears its own hysteresis margin.
      const criticalHeld =
        alert.severity === 'alert' &&
        (rule.lower
          ? value < thresholds[rule.alert] + HYSTERESIS[metric]
          : value > thresholds[rule.alert] - HYSTERESIS[metric]);
      const nextSeverity = criticalHeld ? 'alert' : (breach?.severity ?? 'warning');
      const escalated = alert.severity === 'warning' && nextSeverity === 'alert';
      const next = db.updateAlert(
        alert.id,
        {
          ...alert,
          value,
          severity: nextSeverity,
          threshold: thresholds[rule[nextSeverity]],
          state: escalated ? 'OPEN' : alert.state,
          message: `${metric} ${value}: ${nextSeverity}`,
        },
        reading.ts,
        nextSeverity !== alert.severity ? 'UPDATE' : undefined,
      );
      if (nextSeverity !== alert.severity) changes.push(next);
      breach = undefined;
      if (nextSeverity === 'alert' || severity === 'normal') severity = nextSeverity;
    }
    if (active.length || !breach) continue;
    const previous = history[0];
    const elapsed = previous?.resolvedAt
      ? Date.parse(reading.ts) - Date.parse(previous.resolvedAt)
      : Infinity;
    const alert =
      previous && elapsed >= 0 && elapsed < ALERT_COOLDOWN_MS
        ? db.updateAlert(previous.id, { ...breach, state: 'OPEN' }, reading.ts, 'REOPEN')
        : db.insertAlert({ ...breach, nodeId: reading.nodeId, ts: reading.ts });
    changes.push(alert);
    if (alert.severity === 'alert' || severity === 'normal') severity = alert.severity;
  }
  return { changes, severity };
}
