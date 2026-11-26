import { useEffect } from 'react';
import { useResource } from './useResource';
import { getSocket } from '../lib/socket';
import type { AlertRecord } from '../types';
const merge = (snapshot: AlertRecord[], current: AlertRecord[]) =>
  [...new Map([...snapshot, ...current].map((a) => [a.id, a])).values()]
    .sort((a, b) => b.id - a.id)
    .slice(0, 100);
export function useAlerts() {
  const resource = useResource<AlertRecord[]>('/api/alerts?limit=100', [], 15_000, merge);
  const { setData } = resource;
  useEffect(() => {
    const socket = getSocket();
    const onAlert = (alert: AlertRecord) =>
      setData((previous) =>
        [alert, ...previous.filter((a) => a.id !== alert.id)]
          .sort((a, b) => b.id - a.id)
          .slice(0, 100),
      );
    socket.on('alert', onAlert);
    return () => {
      socket.off('alert', onAlert);
    };
  }, [setData]);
  return {
    alerts: resource.data,
    loading: resource.loading,
    error: resource.error,
    reload: resource.reload,
  };
}
