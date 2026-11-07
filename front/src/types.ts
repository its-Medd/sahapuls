export type Severity = 'normal' | 'warning' | 'alert';

export type MetricName = 'temperatureC' | 'gasPpm' | 'batteryPct';

export interface NodeRecord {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  installedAt: string;
  lastSeenAt: string | null;
  status: Severity;
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
}
