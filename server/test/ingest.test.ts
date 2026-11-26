import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardDatabase } from '../src/db/database.js';
import { ingestTelemetry, type RealtimeEmitter } from '../src/ingest.js';
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

function fakeEmitter(): RealtimeEmitter & {
  readings: unknown[];
  alerts: unknown[];
  statuses: unknown[];
} {
  const readings: unknown[] = [];
  const alerts: unknown[] = [];
  const statuses: unknown[] = [];
  return {
    readings,
    alerts,
    statuses,
    emitReading: (r) => readings.push(r),
    emitAlert: (a) => alerts.push(a),
    emitNodeStatus: (nodeId, status) => statuses.push({ nodeId, status }),
  };
}

describe('ingestTelemetry', () => {
  let db: DashboardDatabase;

  beforeEach(() => {
    db = new DashboardDatabase(':memory:');
    db.upsertNode({
      nodeId: 'node-01',
      name: 'Ridge North',
      lat: 49.98,
      lng: -119.4,
      installedAt: reading().ts,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('persists a normal reading and does not raise an alert', () => {
    const emitter = fakeEmitter();
    const result = ingestTelemetry(db, reading(), emitter);

    expect(result.severity).toBe('normal');
    expect(result.alerts).toHaveLength(0);
    expect(emitter.readings).toHaveLength(1);
    expect(emitter.alerts).toHaveLength(0);
    expect(emitter.statuses).toEqual([{ nodeId: 'node-01', status: 'normal' }]);

    const stored = db.getReadings('node-01');
    expect(stored).toHaveLength(1);
    expect(stored[0]?.severity).toBe('normal');
  });

  it('raises and persists an alert when a reading breaches a threshold', () => {
    const emitter = fakeEmitter();
    const result = ingestTelemetry(db, reading({ temperatureC: 60, gasPpm: 500 }), emitter);

    expect(result.severity).toBe('alert');
    expect(result.alerts).toHaveLength(2);
    expect(emitter.alerts).toHaveLength(2);

    const storedAlerts = db.getAlerts({ nodeId: 'node-01' });
    expect(storedAlerts).toHaveLength(2);
    expect(storedAlerts.map((a) => a.metric).sort()).toEqual(['gasPpm', 'temperatureC']);
  });

  it('updates the node status to reflect the latest severity', () => {
    ingestTelemetry(db, reading({ temperatureC: 60 }));
    const node = db.getNode('node-01');
    expect(node?.status).toBe('alert');
    expect(node?.lastSeenAt).toBe(reading().ts);
  });

  it('works with the default no-op emitter when none is supplied', () => {
    expect(() => ingestTelemetry(db, reading())).not.toThrow();
  });

  it('calls emitter methods in a sensible order (reading/status before alerts)', () => {
    const calls: string[] = [];
    const emitter: RealtimeEmitter = {
      emitReading: () => calls.push('reading'),
      emitAlert: () => calls.push('alert'),
      emitNodeStatus: () => calls.push('status'),
    };
    ingestTelemetry(db, reading({ temperatureC: 60 }), emitter);
    expect(calls).toEqual(['reading', 'status', 'alert']);
  });

  it('does not call the emitter with vi.fn spies more than expected', () => {
    const emitReading = vi.fn();
    const emitAlert = vi.fn();
    const emitNodeStatus = vi.fn();
    ingestTelemetry(db, reading(), { emitReading, emitAlert, emitNodeStatus });
    expect(emitReading).toHaveBeenCalledTimes(1);
    expect(emitNodeStatus).toHaveBeenCalledTimes(1);
    expect(emitAlert).not.toHaveBeenCalled();
  });
});
