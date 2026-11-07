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

function log(message: string): void {
  console.log(`[mqtt] ${new Date().toISOString()} ${message}`);
}

/**
 * Connects to the broker, subscribes to the fleet's telemetry/meta topics,
 * and feeds validated messages into the shared ingest pipeline. Returns the
 * underlying client so callers can close it on shutdown.
 */
export async function startMqttSubscriber(
  db: DashboardDatabase,
  emitter: RealtimeEmitter,
  options: MqttSubscriberOptions,
): Promise<MqttClient> {
  const client = await mqtt.connectAsync(options.mqttUrl, {
    username: options.mqttUsername,
    password: options.mqttPassword,
    clientId: `lora-server-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 2000,
  });

  const telemetryTopic = `${options.topicPrefix}/+/telemetry`;
  const metaTopic = `${options.topicPrefix}/+/meta`;
  await client.subscribeAsync([telemetryTopic, metaTopic], { qos: 0 });
  log(`subscribed to ${telemetryTopic} and ${metaTopic}`);

  client.on('reconnect', () => log('reconnecting to broker...'));
  client.on('error', (err) => log(`mqtt error: ${err.message}`));

  client.on('message', (topic, payload) => {
    const parsedTopic = parseTopic(topic, options.topicPrefix);
    if (!parsedTopic) return;

    if (parsedTopic.kind === 'meta') {
      const result = parseNodeMetaPayload(payload);
      if (!result.ok) {
        log(`dropped invalid meta message on ${topic}: ${result.error}`);
        return;
      }
      db.upsertNode(result.data);
      return;
    }

    const result = parseTelemetryPayload(payload);
    if (!result.ok) {
      log(`dropped invalid telemetry message on ${topic}: ${result.error}`);
      return;
    }

    // A node might publish telemetry before its retained meta message has
    // been seen (e.g. server restarted after the simulator). Make sure a row
    // exists so the foreign-key-style reference and the /api/nodes listing
    // both work even in that ordering.
    if (!db.getNode(result.data.nodeId)) {
      db.upsertNode({
        nodeId: result.data.nodeId,
        name: result.data.nodeId,
        lat: result.data.lat,
        lng: result.data.lng,
        installedAt: result.data.ts,
      });
    }

    ingestTelemetry(db, result.data, emitter);
  });

  return client;
}
