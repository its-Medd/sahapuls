import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { Aedes } from 'aedes';
import mqtt from 'mqtt';
import { expect, it, vi } from 'vitest';
import { DashboardDatabase } from '../src/db/database.js';
import { startMqttSubscriber } from '../src/mqtt/subscriber.js';
import { SimulatorBridge } from '../src/simulator.js';
it('ingests retained metadata and telemetry over a real MQTT transport, rejects spoofing and detects duplicates', async () => {
  const broker = await Aedes.createBroker();
  const server = createServer(broker.handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `mqtt://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const db = new DashboardDatabase(':memory:');
  const emitter = {
    emitReading: vi.fn(),
    emitAlert: vi.fn(),
    emitNodeStatus: vi.fn(),
    emitNode: vi.fn(),
  };
  const publisher = await mqtt.connectAsync(url);
  let subscriber: mqtt.MqttClient | undefined;
  try {
    await publisher.publishAsync(
      'lora/n1/meta',
      JSON.stringify({
        nodeId: 'n1',
        name: 'Retained station',
        lat: 0,
        lng: 0,
        installedAt: '2026-01-01T00:00:00.000Z',
      }),
      { qos: 1, retain: true },
    );
    subscriber = await startMqttSubscriber(db, emitter, { mqttUrl: url, topicPrefix: 'lora' });
    await vi.waitFor(() => expect(db.getNode('n1')?.name).toBe('Retained station'));
    const reading = {
      nodeId: 'n1',
      seq: 1,
      ts: new Date().toISOString(),
      temperatureC: 50,
      humidityPct: 40,
      gasPpm: 10,
      batteryPct: 90,
      soilMoisturePct: 12,
      waterLevelCm: 60,
      lat: 0,
      lng: 0,
      simulatedAlert: true,
    };
    await publisher.publishAsync('lora/spoofed/telemetry', JSON.stringify(reading), { qos: 1 });
    await publisher.publishAsync('lora/n1/telemetry', JSON.stringify(reading), { qos: 1 });
    await publisher.publishAsync('lora/n1/telemetry', JSON.stringify(reading), { qos: 1 });
    await vi.waitFor(() => expect(emitter.emitReading).toHaveBeenCalledTimes(1));
    expect(db.getNodes()).toHaveLength(1);
    expect(db.getAlerts()).toHaveLength(2);
    const bridge = new SimulatorBridge(subscriber, 'lora');
    await expect(
      bridge.command({ running: true, scenario: 'normal', intervalMs: 250 }),
    ).rejects.toMatchObject({ status: 503 });
    bridge.close();
  } finally {
    await subscriber?.endAsync(true);
    await publisher.endAsync(true);
    db.close();
    await broker.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 10000);

it('reconnects to a restarted broker without accumulating message handlers or duplicate ingestion', async () => {
  let broker = await Aedes.createBroker();
  let server = createServer(broker.handle);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port,
    url = `mqtt://127.0.0.1:${port}`;
  const db = new DashboardDatabase(':memory:');
  const emitter = { emitReading: vi.fn(), emitAlert: vi.fn(), emitNodeStatus: vi.fn() };
  const subscriber = await startMqttSubscriber(db, emitter, { mqttUrl: url, topicPrefix: 'lora' });
  let publisher = await mqtt.connectAsync(url);
  try {
    await publisher.publishAsync(
      'lora/reconnect/meta',
      JSON.stringify({
        nodeId: 'reconnect',
        name: 'Reconnect station',
        lat: 0,
        lng: 0,
        installedAt: new Date().toISOString(),
      }),
      { qos: 1, retain: true },
    );
    await vi.waitFor(() => expect(db.getNode('reconnect')).toBeDefined(), { timeout: 10000 });
    const reading = {
      nodeId: 'reconnect',
      seq: 1,
      ts: new Date().toISOString(),
      temperatureC: 22,
      humidityPct: 50,
      gasPpm: 10,
      batteryPct: 90,
      lat: 0,
      lng: 0,
      simulatedAlert: false,
    };
    await publisher.publishAsync('lora/reconnect/telemetry', JSON.stringify(reading), { qos: 1 });
    await vi.waitFor(() => expect(emitter.emitReading).toHaveBeenCalledTimes(1));
    await publisher.endAsync(true);
    await broker.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await vi.waitFor(() => expect(subscriber.connected).toBe(false));
    broker = await Aedes.createBroker();
    server = createServer(broker.handle);
    const subscribed = new Promise<void>((resolve) =>
      broker.on('subscribe', (subscriptions: { topic: string }[], client: { id: string }) => {
        if (
          client.id.startsWith('sahapul-server-') &&
          subscriptions.some((subscription) => subscription.topic === 'lora/+/telemetry')
        )
          resolve();
      }),
    );
    await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
    publisher = await mqtt.connectAsync(url);
    await subscribed;
    const next = { ...reading, seq: 2, ts: new Date().toISOString() };
    await publisher.publishAsync('lora/reconnect/telemetry', JSON.stringify(next), { qos: 1 });
    await publisher.publishAsync('lora/reconnect/telemetry', JSON.stringify(next), { qos: 1 });
    await vi.waitFor(() => expect(emitter.emitReading).toHaveBeenCalledTimes(2));
    expect(subscriber.listenerCount('message')).toBe(1);
    expect(db.getReadings('reconnect')).toHaveLength(2);
  } finally {
    await subscriber.endAsync(true);
    await publisher.endAsync(true);
    db.close();
    await broker.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}, 30000);
