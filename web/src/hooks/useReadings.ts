import { useEffect, useState } from 'react';
import { requestJson } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { ReadingRecord } from '../types';
const MAX_POINTS = 500;
export function useReadings(nodeId: string | undefined) {
  const [state, setState] = useState<{
    nodeId?: string;
    readings: ReadingRecord[];
    loading: boolean;
    error?: string;
  }>({ readings: [], loading: false });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!nodeId) {
      setState({ readings: [], loading: false });
      return;
    }
    const controller = new AbortController();
    const socket = getSocket();
    const live = new Map<number, ReadingRecord>();
    let fetched = false;
    setState({ nodeId, readings: [], loading: true });
    const merge = (rows: ReadingRecord[]) =>
      [...new Map([...rows, ...live.values()].map((r) => [r.id, r])).values()]
        .sort((a, b) => a.ts.localeCompare(b.ts) || a.id - b.id)
        .slice(-MAX_POINTS);
    const onReading = (reading: ReadingRecord) => {
      if (reading.nodeId !== nodeId) return;
      if (!fetched) live.set(reading.id, reading);
      setState((previous) => ({ ...previous, readings: merge([...previous.readings, reading]) }));
    };
    const reload = () => setRevision((n) => n + 1);
    socket.on('reading', onReading);
    socket.on('connect', reload);
    requestJson<ReadingRecord[]>(
      `/api/nodes/${encodeURIComponent(nodeId)}/readings?limit=${MAX_POINTS}`,
      { signal: controller.signal },
    )
      .then((rows) => {
        if (!controller.signal.aborted) {
          setState({ nodeId, readings: merge(rows), loading: false });
          fetched = true;
          live.clear();
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          fetched = true;
          setState((previous) => ({
            ...previous,
            loading: false,
            error: err instanceof Error ? err.message : 'Could not load readings.',
          }));
        }
      });
    return () => {
      controller.abort();
      socket.off('reading', onReading);
      socket.off('connect', reload);
    };
  }, [nodeId, revision]);
  return {
    readings: state.nodeId === nodeId ? state.readings : [],
    loading: state.loading,
    error: state.error,
    reload: () => setRevision((n) => n + 1),
  };
}
