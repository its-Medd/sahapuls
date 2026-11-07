import type { Server as HttpServer } from 'node:http';
import { Server as SocketIoServer } from 'socket.io';
import type { DashboardDatabase } from '../db/database.js';
import type { RealtimeEmitter } from '../ingest.js';
import type { AlertRecord, ReadingRecord, Severity } from '../types.js';

export interface ServerToClientEvents {
  reading: (reading: ReadingRecord) => void;
  alert: (alert: AlertRecord) => void;
  'node-status': (payload: { nodeId: string; status: Severity }) => void;
}

/**
 * Thin adapter that satisfies the ingest pipeline's RealtimeEmitter interface
 * by broadcasting over Socket.IO. Kept separate from the ingest pipeline
 * itself so that pipeline can be unit tested without spinning up a socket
 * server.
 */
export function createSocketServer(
  httpServer: HttpServer,
  db: DashboardDatabase,
  corsOrigin: string,
): { io: SocketIoServer<object, ServerToClientEvents>; emitter: RealtimeEmitter } {
  const io = new SocketIoServer<object, ServerToClientEvents>(httpServer, {
    cors: { origin: corsOrigin },
  });

  io.on('connection', (socket) => {
    // Push a snapshot of current node state on connect so the dashboard
    // doesn't have to wait for the next telemetry tick to render anything.
    for (const node of db.getNodes()) {
      socket.emit('node-status', { nodeId: node.nodeId, status: node.status });
    }
  });

  const emitter: RealtimeEmitter = {
    emitReading: (reading) => io.emit('reading', reading),
    emitAlert: (alert) => io.emit('alert', alert),
    emitNodeStatus: (nodeId, status) => io.emit('node-status', { nodeId, status }),
  };

  return { io, emitter };
}
