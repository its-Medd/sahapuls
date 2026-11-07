import type { MetricName, RuleBreach, Severity, TelemetryReading } from '../types.js';

export interface Thresholds {
  temperatureWarningC: number;
  temperatureAlertC: number;
  gasWarningPpm: number;
  gasAlertPpm: number;
  /** Battery is inverted: a LOW value is bad, so "warning"/"alert" are upper bounds the value must fall at or below. */
  batteryWarningPct: number;
  batteryAlertPct: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  temperatureWarningC: 35,
  temperatureAlertC: 45,
  gasWarningPpm: 150,
  gasAlertPpm: 400,
  batteryWarningPct: 20,
  batteryAlertPct: 10,
};

export interface ThresholdEvaluation {
  severity: Severity;
  breaches: RuleBreach[];
}

const severityRank: Record<Severity, number> = { normal: 0, warning: 1, alert: 2 };

function highestSeverity(severities: Severity[]): Severity {
  return severities.reduce<Severity>(
    (max, current) => (severityRank[current] > severityRank[max] ? current : max),
    'normal',
  );
}

function evaluateUpperBound(
  metric: MetricName,
  value: number,
  warningThreshold: number,
  alertThreshold: number,
  unit: string,
): RuleBreach | null {
  if (value >= alertThreshold) {
    return {
      metric,
      severity: 'alert',
      value,
      threshold: alertThreshold,
      message: `${metric} ${value}${unit} at or above alert threshold ${alertThreshold}${unit}`,
    };
  }
  if (value >= warningThreshold) {
    return {
      metric,
      severity: 'warning',
      value,
      threshold: warningThreshold,
      message: `${metric} ${value}${unit} at or above warning threshold ${warningThreshold}${unit}`,
    };
  }
  return null;
}

function evaluateLowerBound(
  metric: MetricName,
  value: number,
  warningThreshold: number,
  alertThreshold: number,
  unit: string,
): RuleBreach | null {
  if (value <= alertThreshold) {
    return {
      metric,
      severity: 'alert',
      value,
      threshold: alertThreshold,
      message: `${metric} ${value}${unit} at or below alert threshold ${alertThreshold}${unit}`,
    };
  }
  if (value <= warningThreshold) {
    return {
      metric,
      severity: 'warning',
      value,
      threshold: warningThreshold,
      message: `${metric} ${value}${unit} at or below warning threshold ${warningThreshold}${unit}`,
    };
  }
  return null;
}

/**
 * Pure function evaluating a single telemetry reading against a set of
 * thresholds. Deliberately has no knowledge of MQTT, the database, or
 * previous readings so it can be unit tested directly and reused anywhere
 * (REST layer, MQTT ingest pipeline, or an offline batch job).
 */
export function evaluateThresholds(
  reading: Pick<TelemetryReading, 'temperatureC' | 'gasPpm' | 'batteryPct'>,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): ThresholdEvaluation {
  const breaches: RuleBreach[] = [];

  const temperatureBreach = evaluateUpperBound(
    'temperatureC',
    reading.temperatureC,
    thresholds.temperatureWarningC,
    thresholds.temperatureAlertC,
    'C',
  );
  if (temperatureBreach) breaches.push(temperatureBreach);

  const gasBreach = evaluateUpperBound(
    'gasPpm',
    reading.gasPpm,
    thresholds.gasWarningPpm,
    thresholds.gasAlertPpm,
    'ppm',
  );
  if (gasBreach) breaches.push(gasBreach);

  const batteryBreach = evaluateLowerBound(
    'batteryPct',
    reading.batteryPct,
    thresholds.batteryWarningPct,
    thresholds.batteryAlertPct,
    '%',
  );
  if (batteryBreach) breaches.push(batteryBreach);

  return {
    severity: highestSeverity(breaches.map((b) => b.severity)),
    breaches,
  };
}
