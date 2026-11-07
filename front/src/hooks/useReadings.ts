import { useEffect, useState } from 'react';
import { fetchReadings } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { ReadingRecord } from '../types';

const MAX_POINTS = 200;

/** Loads recent history for a node over REST, then appends live readings from the socket feed. */
export function useReadings(nodeId: string | undefined): {
  readings: ReadingRecord[];
  loading: boolean;
} {
  const [readings, setReadings] = useState<ReadingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nodeId) {
      setReadings([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchReadings(nodeId, MAX_POINTS)
      .then((fetched) => {
        if (!cancelled) setReadings(fetched);
      })
      .catch(() => {
        if (!cancelled) setReadings([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [nodeId]);

  useEffect(() => {
    if (!nodeId) return;
    const socket = getSocket();

    const onReading = (reading: ReadingRecord): void => {
      if (reading.nodeId !== nodeId) return;
      setReadings((prev) => [...prev.slice(-(MAX_POINTS - 1)), reading]);
    };

    socket.on('reading', onReading);
    return () => {
      socket.off('reading', onReading);
    };
  }, [nodeId]);

  return { readings, loading };
}
