import type { AlertRecord, AlertEvent, NodeRecord, ReadingRecord } from '../types';
export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:4000' : 'http://localhost:4000');
export async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(10_000);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${response.status}). Check the API and retry.`);
  }
  return (await response.json()) as T;
}
export const fetchNodes = () => requestJson<NodeRecord[]>('/api/nodes');
export const fetchAlerts = (limit = 100) =>
  requestJson<AlertRecord[]>(`/api/alerts?limit=${limit}`);
export const fetchReadings = (nodeId: string, limit = 200) =>
  requestJson<ReadingRecord[]>(`/api/nodes/${encodeURIComponent(nodeId)}/readings?limit=${limit}`);
export const acknowledgeAlert = (id: number) =>
  requestJson<AlertRecord>(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
export const fetchAlertHistory = (id: number) =>
  requestJson<AlertEvent[]>(`/api/alerts/${id}/history`);
export interface Summary {
  readingCount: number;
  activeAlerts: number;
  latestReadings: ReadingRecord[];
  openAlerts: number;
  acknowledgedAlerts: number;
}
export interface Health {
  application: string;
  version: string;
  status: string;
  ready: boolean;
  mqttConnected: boolean;
  time: string;
  components: {
    http: { status: string };
    sqlite: {
      status: string;
      schemaVersion?: number;
      journalMode?: string;
      foreignKeys?: boolean;
      engine?: string;
    };
    mqtt: { status: string };
    simulator: { status: string; requiredForReadiness: boolean; updatedAt: string | null };
  };
}
export interface MetricStatistics {
  avg: number;
  min: number;
  max: number;
  count?: number;
}
export interface Analytics {
  nodeId: string;
  from: string | null;
  to: string | null;
  bucketMs: number;
  sampleCount: number;
  statistics: Record<import('../types').MetricName, MetricStatistics | null>;
  buckets: ({ bucketStart: string; sampleCount: number } & Record<
    import('../types').MetricName,
    MetricStatistics | null
  >)[];
}
export interface SimulatorState {
  available: boolean;
  running?: boolean;
  scenario?: string;
  intervalMs?: number;
  updatedAt?: string;
}
export interface Settings {
  thresholds: Record<string, number>;
  rules: Record<string, { warning: string; alert: string; lower: boolean }>;
  hysteresis: Record<string, number>;
  alertCooldownMs: number;
  staleAfterMs: number;
  offlineAfterMs: number;
}
