import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DashboardDatabase } from '../src/db/database.js';
import { ingestTelemetry, type RealtimeEmitter } from '../src/ingest.js';
import { createSocketServer } from '../src/realtime/socket.js';
import type { TelemetryReading } from '../src/types.js';

function reading(overrides: Partial<TelemetryReading> = {}): TelemetryReading {
  return {
    nodeId: 'node-01',
    seq: 1,
    ts: '2026-07-11T00:00:00.000Z',
    temperatureC: 20,
    humidityPct: 45,
    gasPpm: 10,
    batteryPct: 90,
    lat: 49.98,
    lng: -119.4,
    simulatedAlert: false,
    ...overrides,
  };
}

/**
 * These tests boot a real Socket.IO server on an ephemeral localhost port and
 * connect a real socket.io-client - no mocking of the transport - to confirm
 * the emitter created by createSocketServer actually reaches connected
 * clients end-to-end, the same path the React dashboard relies on.
 */
describe('realtime socket server', () => {
  let db: DashboardDatabase;
  let httpServer: HttpServer;
  let clientSocket: ClientSocket;
  let emitter: RealtimeEmitter;
  let port: number;

  beforeEach(async () => {
    db = new DashboardDatabase(':memory:');
    db.upsertNode({
      nodeId: 'node-01',
      name: 'Ridge North',
      lat: 49.98,
      lng: -119.4,
      installedAt: reading().ts,
    });

    httpServer = createServer();
    ({ emitter } = createSocketServer(httpServer, db, '*'));

    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    port = (httpServer.address() as AddressInfo).port;
    clientSocket = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
    // Wait for the initial node-status snapshot so later listeners in each
    // test aren't racing against connection setup.
    await new Promise((resolve) => clientSocket.once('node-status', resolve));
  });

  afterEach(async () => {
    clientSocket.close();
    db.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it('sends a node-status snapshot reflecting the DB to a newly connected client', async () => {
    // A second client connecting later should also get the current snapshot.
    const secondClient = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
    const snapshot = await new Promise((resolve) => secondClient.once('node-status', resolve));
    secondClient.close();

    expect(snapshot).toEqual({ nodeId: 'node-01', status: 'normal' });
  });

  it('broadcasts a reading event to connected clients when telemetry is ingested', async () => {
    const receivedReading = new Promise((resolve) => clientSocket.once('reading', resolve));

    ingestTelemetry(db, reading({ temperatureC: 21 }), emitter);

    const received = await receivedReading;
    expect(received).toMatchObject({ nodeId: 'node-01', temperatureC: 21 });
  });

  it('broadcasts an alert event when a reading breaches a threshold', async () => {
    const receivedAlert = new Promise((resolve) => clientSocket.once('alert', resolve));

    ingestTelemetry(db, reading({ temperatureC: 60 }), emitter);

    const received = await receivedAlert;
    expect(received).toMatchObject({
      nodeId: 'node-01',
      metric: 'temperatureC',
      severity: 'alert',
    });
  });

  it('broadcasts a node-status update alongside the reading', async () => {
    const receivedStatus = new Promise((resolve) => clientSocket.once('node-status', resolve));

    ingestTelemetry(db, reading({ gasPpm: 500 }), emitter);

    const received = await receivedStatus;
    expect(received).toEqual({ nodeId: 'node-01', status: 'alert' });
  });
});
