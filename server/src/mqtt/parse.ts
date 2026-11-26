import { z } from 'zod';
import type { NodeMeta, TelemetryReading } from '../types.js';

export const MAX_PAYLOAD_BYTES = 16_384;
export const nodeIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
export const timestampSchema = z
  .string()
  .datetime({ offset: true })
  .transform((s) => new Date(s).toISOString());
const percent = z.number().finite().min(0).max(100);
export const telemetrySchema = z.object({
  nodeId: nodeIdSchema,
  seq: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ts: timestampSchema,
  temperatureC: z.number().finite().min(-100).max(150),
  humidityPct: percent,
  gasPpm: z.number().finite().min(0).max(1_000_000),
  batteryPct: percent,
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  simulatedAlert: z.boolean(),
  soilMoisturePct: percent.nullish().transform((v) => v ?? null),
  waterLevelCm: z
    .number()
    .finite()
    .min(0)
    .max(100_000)
    .nullish()
    .transform((v) => v ?? null),
});
const nodeMetaSchema = z.object({
  nodeId: nodeIdSchema,
  name: z.string().trim().min(1).max(100),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  installedAt: timestampSchema,
});
export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function parse<T>(
  raw: Buffer | string,
  schema: z.ZodType<T, unknown>,
  topicNodeId?: string,
): ParseResult<T> {
  if (Buffer.byteLength(raw) > MAX_PAYLOAD_BYTES)
    return { ok: false, error: 'payload exceeds 16384 bytes' };
  try {
    const result = schema.safeParse(JSON.parse(raw.toString()));
    if (!result.success)
      return {
        ok: false,
        error: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      };
    if (topicNodeId !== undefined && (result.data as { nodeId: string }).nodeId !== topicNodeId) {
      return { ok: false, error: 'topic and payload device identifiers differ' };
    }
    return { ok: true, data: result.data };
  } catch {
    return { ok: false, error: 'payload is not valid JSON' };
  }
}
export function parseTelemetryPayload(
  raw: Buffer | string,
  topicNodeId?: string,
): ParseResult<TelemetryReading> {
  return parse(raw, telemetrySchema, topicNodeId);
}
export function parseNodeMetaPayload(
  raw: Buffer | string,
  topicNodeId?: string,
): ParseResult<NodeMeta> {
  return parse(raw, nodeMetaSchema, topicNodeId);
}
export function parseTopic(
  topic: string,
  prefix: string,
): { nodeId: string; kind: 'telemetry' | 'meta' } | null {
  const parts = topic.split('/');
  if (parts.length !== 3 || parts[0] !== prefix || !nodeIdSchema.safeParse(parts[1]).success)
    return null;
  if (parts[2] !== 'telemetry' && parts[2] !== 'meta') return null;
  return { nodeId: parts[1]!, kind: parts[2] };
}
