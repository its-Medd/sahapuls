import { z } from 'zod';
import type { NodeMeta, TelemetryReading } from '../types.js';

const telemetrySchema = z.object({
  nodeId: z.string().min(1),
  seq: z.number(),
  ts: z.string(),
  temperatureC: z.number(),
  humidityPct: z.number(),
  gasPpm: z.number(),
  batteryPct: z.number(),
  lat: z.number(),
  lng: z.number(),
  simulatedAlert: z.boolean(),
});

const nodeMetaSchema = z.object({
  nodeId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  installedAt: z.string(),
});

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parses and validates a raw MQTT telemetry payload. Never throws. */
export function parseTelemetryPayload(raw: Buffer | string): ParseResult<TelemetryReading> {
  let json: unknown;
  try {
    json = JSON.parse(raw.toString());
  } catch {
    return { ok: false, error: 'payload is not valid JSON' };
  }

  const result = telemetrySchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, data: result.data };
}

/** Parses and validates a raw MQTT retained node-metadata payload. Never throws. */
export function parseNodeMetaPayload(raw: Buffer | string): ParseResult<NodeMeta> {
  let json: unknown;
  try {
    json = JSON.parse(raw.toString());
  } catch {
    return { ok: false, error: 'payload is not valid JSON' };
  }

  const result = nodeMetaSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Extracts the nodeId and message kind ("telemetry" | "meta") out of a topic
 * of the form `${prefix}/${nodeId}/${kind}`. Returns null if the topic
 * doesn't match the expected shape.
 */
export function parseTopic(
  topic: string,
  topicPrefix: string,
): { nodeId: string; kind: 'telemetry' | 'meta' } | null {
  const parts = topic.split('/');
  if (parts.length !== 3) return null;
  const [prefix, nodeId, kind] = parts;
  if (prefix !== topicPrefix) return null;
  if (kind !== 'telemetry' && kind !== 'meta') return null;
  if (!nodeId) return null;
  return { nodeId, kind };
}
