import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import type { AlertRecord, ReadingRecord, Severity } from '../types';

export interface ServerToClientEvents {
  reading: (reading: ReadingRecord) => void;
  alert: (alert: AlertRecord) => void;
  'node-status': (payload: { nodeId: string; status: Severity }) => void;
}

let socket: Socket<ServerToClientEvents> | undefined;

/** Lazily creates a single shared Socket.IO connection for the app's lifetime. */
export function getSocket(): Socket<ServerToClientEvents> {
  socket ??= io(API_BASE_URL, { transports: ['websocket'], autoConnect: true });
  return socket;
}
