import { useEffect, useState } from 'react';
import { fetchNodes } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { NodeRecord, Severity } from '../types';

/**
 * Loads the node list over REST once, then keeps each node's `status` and
 * `lastSeenAt` in sync from live `node-status` / `reading` socket events so
 * the map and node list update in real time without polling.
 */
export function useNodes(): { nodes: NodeRecord[]; loading: boolean; error: string | undefined } {
  const [nodes, setNodes] = useState<NodeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    fetchNodes()
      .then((fetched) => {
        if (!cancelled) setNodes(fetched);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'failed to load nodes');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const onStatus = (payload: { nodeId: string; status: Severity }): void => {
      setNodes((prev) =>
        prev.map((n) => (n.nodeId === payload.nodeId ? { ...n, status: payload.status } : n)),
      );
    };

    const onReading = (reading: { nodeId: string; ts: string; lat: number; lng: number }): void => {
      setNodes((prev) =>
        prev.map((n) =>
          n.nodeId === reading.nodeId
            ? { ...n, lastSeenAt: reading.ts, lat: reading.lat, lng: reading.lng }
            : n,
        ),
      );
    };

    socket.on('node-status', onStatus);
    socket.on('reading', onReading);

    return () => {
      socket.off('node-status', onStatus);
      socket.off('reading', onReading);
    };
  }, []);

  return { nodes, loading, error };
}
