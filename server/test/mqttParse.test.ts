import { describe, expect, it } from 'vitest';
import { parseNodeMetaPayload, parseTelemetryPayload, parseTopic } from '../src/mqtt/parse.js';

const validReading = {
  nodeId: 'node-01',
  seq: 1,
  ts: '2026-07-11T00:00:00.000Z',
  temperatureC: 21.4,
  humidityPct: 45.2,
  gasPpm: 8.1,
  batteryPct: 92.3,
  lat: 49.98,
  lng: -119.4,
  simulatedAlert: false,
};

const validMeta = {
  nodeId: 'node-01',
  name: 'Ridge North',
  lat: 49.98,
  lng: -119.4,
  installedAt: '2026-01-01T00:00:00.000Z',
};

describe('parseTelemetryPayload', () => {
  it('parses a valid telemetry payload from a Buffer', () => {
    const result = parseTelemetryPayload(Buffer.from(JSON.stringify(validReading)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.nodeId).toBe('node-01');
      expect(result.data.temperatureC).toBe(21.4);
    }
  });

  it('rejects malformed JSON', () => {
    const result = parseTelemetryPayload('{not json');
    expect(result.ok).toBe(false);
  });

  it('rejects a payload missing required fields', () => {
    const { humidityPct: _humidityPct, ...incomplete } = validReading;
    const result = parseTelemetryPayload(JSON.stringify(incomplete));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/humidityPct/);
    }
  });

  it('rejects a payload with the wrong type for a field', () => {
    const result = parseTelemetryPayload(JSON.stringify({ ...validReading, temperatureC: 'hot' }));
    expect(result.ok).toBe(false);
  });

  it('rejects a payload that is valid JSON but not an object', () => {
    const result = parseTelemetryPayload(JSON.stringify([1, 2, 3]));
    expect(result.ok).toBe(false);
  });
});

describe('parseNodeMetaPayload', () => {
  it('parses a valid meta payload', () => {
    const result = parseNodeMetaPayload(JSON.stringify(validMeta));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Ridge North');
    }
  });

  it('rejects a meta payload missing a name', () => {
    const { name: _name, ...incomplete } = validMeta;
    const result = parseNodeMetaPayload(JSON.stringify(incomplete));
    expect(result.ok).toBe(false);
  });
});

describe('parseTopic', () => {
  it('extracts nodeId and kind from a well-formed telemetry topic', () => {
    expect(parseTopic('lora/node-01/telemetry', 'lora')).toEqual({
      nodeId: 'node-01',
      kind: 'telemetry',
    });
  });

  it('extracts nodeId and kind from a well-formed meta topic', () => {
    expect(parseTopic('lora/node-02/meta', 'lora')).toEqual({ nodeId: 'node-02', kind: 'meta' });
  });

  it('returns null for a topic with the wrong prefix', () => {
    expect(parseTopic('other/node-01/telemetry', 'lora')).toBeNull();
  });

  it('returns null for a topic with an unknown message kind', () => {
    expect(parseTopic('lora/node-01/command', 'lora')).toBeNull();
  });

  it('returns null for a topic with the wrong number of segments', () => {
    expect(parseTopic('lora/telemetry', 'lora')).toBeNull();
    expect(parseTopic('lora/node-01/telemetry/extra', 'lora')).toBeNull();
  });
});
