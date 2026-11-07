import { useEffect, useState } from 'react';
import { fetchAlerts } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { AlertRecord } from '../types';

const MAX_ALERTS = 100;

/** Loads recent alert history over REST, then prepends new alerts as they arrive live. */
export function useAlerts(): { alerts: AlertRecord[]; loading: boolean } {
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchAlerts(MAX_ALERTS)
      .then((fetched) => {
        if (!cancelled) setAlerts(fetched);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
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

    const onAlert = (alert: AlertRecord): void => {
      setAlerts((prev) => [alert, ...prev].slice(0, MAX_ALERTS));
    };

    socket.on('alert', onAlert);
    return () => {
      socket.off('alert', onAlert);
    };
  }, []);

  return { alerts, loading };
}
