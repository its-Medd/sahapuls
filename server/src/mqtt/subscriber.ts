import mqtt, { type MqttClient } from 'mqtt';
import type { DashboardDatabase } from '../db/database.js';
import { ingestTelemetry, type RealtimeEmitter } from '../ingest.js';
import { parseNodeMetaPayload, parseTelemetryPayload, parseTopic } from './parse.js';

export interface MqttSubscriberOptions {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  topicPrefix: string;
}
export function processMqttMessage(
  db: DashboardDatabase,
  emitter: RealtimeEmitter,
  topic: string,
  payload: Buffer,
  prefix: string,
): boolean {
  const parsed = parseTopic(topic, prefix);
  if (!parsed) return false;
  if (parsed.kind === 'meta') {
    const result = parseNodeMetaPayload(payload, parsed.nodeId);
    if (!result.ok) return false;
    db.upsertNode(result.data);
    emitter.emitNode?.(db.getNode(result.data.nodeId)!);
    return true;
  }
  const result = parseTelemetryPayload(payload, parsed.nodeId);
  if (!result.ok || Date.parse(result.data.ts) > Date.now() + 300_000) return false;
  ingestTelemetry(db, result.data, emitter);
  return true;
}
/** Handlers exist before subscribing, including retained metadata delivery. HTTP can start without a broker. */
export async function startMqttSubscriber(
  db: DashboardDatabase,
  emitter: RealtimeEmitter,
  options: MqttSubscriberOptions,
): Promise<MqttClient> {
  const client = mqtt.connect(options.mqttUrl, {
    username: options.mqttUsername,
    password: options.mqttPassword,
    clientId: `sahapul-server-${Math.random().toString(16).slice(2, 10)}`,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    resubscribe: false,
    queueQoSZero: false,
  });
  client.on('message', (topic, payload) => {
    if (topic === `${options.topicPrefix}/simulator/status`) return;
    try {
      if (!processMqttMessage(db, emitter, topic, payload, options.topicPrefix))
        console.warn('[mqtt] rejected message');
    } catch (error) {
      console.error(
        '[mqtt] message processing failed',
        error instanceof Error ? error.message : 'unknown error',
      );
    }
  });
  client.on('connect', () => {
    console.log('[mqtt] broker connected; subscribing to telemetry and metadata');
    client.subscribe(
      [`${options.topicPrefix}/+/telemetry`, `${options.topicPrefix}/+/meta`],
      { qos: 1 },
      (error, granted) => {
        if (error || granted?.some((g) => g.qos === 128))
          console.error('[mqtt] subscription failed');
      },
    );
  });
  client.on('error', (error) => console.error('[mqtt]', error.message));
  client.on('offline', () => console.warn('[mqtt] broker offline; automatic reconnect enabled'));
  client.on('reconnect', () => console.log('[mqtt] attempting reconnect'));
  return client;
}
