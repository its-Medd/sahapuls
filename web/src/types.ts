export type Severity = 'normal' | 'warning' | 'alert';

export type MetricName =
  'temperatureC' | 'gasPpm' | 'batteryPct' | 'soilMoisturePct' | 'waterLevelCm' | 'humidityPct';
export type AlertState = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface RuleBreach {
  metric: MetricName;
  severity: Exclude<Severity, 'normal'>;
  value: number;
  threshold: number;
  message: string;
}

export interface NodeRecord {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  installedAt: string;
  lastSeenAt: string | null;
  status: Severity;
  communicationHealth?: 'online' | 'stale' | 'offline' | 'never';
  lastReceivedAt?: string | null;
}

export interface ReadingRecord {
  id: number;
  nodeId: string;
  ts: string;
  temperatureC: number;
  humidityPct: number;
  gasPpm: number;
  batteryPct: number;
  lat: number;
  lng: number;
  severity: Severity;
  soilMoisturePct?: number | null;
  waterLevelCm?: number | null;
}

export interface AlertRecord {
  id: number;
  nodeId: string;
  ts: string;
  severity: Exclude<Severity, 'normal'>;
  metric: MetricName;
  value: number;
  threshold: number;
  message: string;
  state: AlertState;
  updatedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface AlertEvent {
  id: number;
  alertId: number;
  ts: string;
  action: 'OPEN' | 'UPDATE' | 'ACKNOWLEDGE' | 'RESOLVE' | 'REOPEN';
}
