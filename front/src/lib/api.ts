import type { AlertRecord, NodeRecord, ReadingRecord } from '../types';

export const API_BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:4000';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`request to ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

export function fetchNodes(): Promise<NodeRecord[]> {
  return getJson<NodeRecord[]>('/api/nodes');
}

export function fetchReadings(nodeId: string, limit = 200): Promise<ReadingRecord[]> {
  return getJson<ReadingRecord[]>(`/api/nodes/${nodeId}/readings?limit=${limit}`);
}

export function fetchAlerts(limit = 50): Promise<AlertRecord[]> {
  return getJson<AlertRecord[]>(`/api/alerts?limit=${limit}`);
}
