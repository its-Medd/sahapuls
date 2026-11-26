/**
 * Wire-format telemetry reading as published by the simulator (see
 * simulator/src/types.ts). Kept as a small standalone type here rather than a
 * shared package - the two services communicate over a documented MQTT/JSON
 * contract, not a shared compile-time module, which mirrors how a real
 * embedded sensor node and a backend would be decoupled in practice.
 */
export interface TelemetryReading {
  nodeId: string;
  seq: number;
  ts: string;
  temperatureC: number;
  humidityPct: number;
  gasPpm: number;
  batteryPct: number;
  lat: number;
  lng: number;
  simulatedAlert: boolean;
  soilMoisturePct?: number | null;
  waterLevelCm?: number | null;
}

export interface NodeMeta {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  installedAt: string;
}

export type Severity = 'normal' | 'warning' | 'alert';

export type MetricName =
  'temperatureC' | 'gasPpm' | 'batteryPct' | 'soilMoisturePct' | 'waterLevelCm';
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
