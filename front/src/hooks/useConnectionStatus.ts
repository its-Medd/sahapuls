import { useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';

/** Tracks whether the shared Socket.IO connection is currently open. */
export function useConnectionStatus(): boolean {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);

    const onConnect = (): void => setConnected(true);
    const onDisconnect = (): void => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}
