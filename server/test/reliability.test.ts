import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import request from 'supertest';
import { DashboardDatabase } from '../src/db/database.js';
import { ingestTelemetry } from '../src/ingest.js';
import { processMqttMessage } from '../src/mqtt/subscriber.js';
import { parseTelemetryPayload, parseNodeMetaPayload } from '../src/mqtt/parse.js';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import type { TelemetryReading } from '../src/types.js';

const base: TelemetryReading = {
  nodeId: 'node-01',
  seq: 1,
  ts: '2026-01-01T00:00:00.000Z',
  temperatureC: 22,
  humidityPct: 50,
  gasPpm: 10,
  batteryPct: 90,
  soilMoisturePct: 50,
  waterLevelCm: 60,
  lat: 0,
  lng: 0,
  simulatedAlert: false,
};
const reading = (seq: number, changes: Partial<TelemetryReading> = {}) => ({
  ...base,
  seq,
  ts: new Date(Date.parse(base.ts) + seq * 1000).toISOString(),
  ...changes,
});
describe('data reliability regressions', () => {
  let db: DashboardDatabase;
  beforeEach(() => {
    db = new DashboardDatabase(':memory:');
  });
  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });
  it('rejects both metadata and telemetry topic/payload mismatches before writes', () => {
    const emitter = { emitReading: vi.fn(), emitAlert: vi.fn(), emitNodeStatus: vi.fn() };
    expect(
      processMqttMessage(
        db,
        emitter,
        'lora/other/telemetry',
        Buffer.from(JSON.stringify(base)),
        'lora',
      ),
    ).toBe(false);
    const meta = { nodeId: 'node-01', name: 'A', lat: 0, lng: 0, installedAt: base.ts };
    expect(parseNodeMetaPayload(JSON.stringify(meta), 'other').ok).toBe(false);
    expect(
      processMqttMessage(db, emitter, 'lora/other/meta', Buffer.from(JSON.stringify(meta)), 'lora'),
    ).toBe(false);
    expect(db.getNodes()).toEqual([]);
    expect(emitter.emitReading).not.toHaveBeenCalled();
  });
  it.each([
    { seq: -1 },
    { seq: 1.5 },
    { humidityPct: 101 },
    { batteryPct: -1 },
    { soilMoisturePct: 101 },
    { waterLevelCm: -1 },
    { lat: 91 },
    { lng: 181 },
    { ts: 'yesterday' },
    { nodeId: 'a/b' },
  ])('rejects malformed measurement %j', (change) => {
    expect(parseTelemetryPayload(JSON.stringify({ ...base, ...change })).ok).toBe(false);
  });
  it('bounds payload size and normalizes offset timestamps', () => {
    expect(parseTelemetryPayload(' '.repeat(16385)).ok).toBe(false);
    const result = parseTelemetryPayload(
      JSON.stringify({ ...base, ts: '2026-01-01T01:00:00+01:00' }),
    );
    expect(result.ok && result.data.ts).toBe(base.ts);
  });
  it('deduplicates persistently without new alerts, node updates or socket events', () => {
    const emitter = { emitReading: vi.fn(), emitAlert: vi.fn(), emitNodeStatus: vi.fn() };
    ingestTelemetry(db, reading(1, { temperatureC: 50 }), emitter);
    expect(ingestTelemetry(db, reading(1, { temperatureC: 50 }), emitter).duplicate).toBe(true);
    expect(db.getReadings('node-01')).toHaveLength(1);
    expect(db.getAlerts()).toHaveLength(1);
    expect(emitter.emitReading).toHaveBeenCalledTimes(1);
  });
  it('rolls back node creation, reading, alert and events when a write fails', () => {
    const emitter = { emitReading: vi.fn(), emitAlert: vi.fn(), emitNodeStatus: vi.fn() };
    vi.spyOn(db, 'insertReading').mockImplementationOnce(() => {
      throw new Error('disk failure');
    });
    expect(() => ingestTelemetry(db, reading(1, { temperatureC: 50 }), emitter)).toThrow(
      'disk failure',
    );
    expect(db.getNodes()).toEqual([]);
    expect(db.getAlerts()).toEqual([]);
    expect(emitter.emitAlert).not.toHaveBeenCalled();
    expect(emitter.emitReading).not.toHaveBeenCalled();
  });
  it('stores late history without rolling back current severity, last seen or active alerts', () => {
    ingestTelemetry(db, reading(2, { temperatureC: 50 }));
    ingestTelemetry(db, reading(1));
    expect(db.getNode('node-01')).toMatchObject({ status: 'alert', lastSeenAt: reading(2).ts });
    expect(db.getAlerts()[0]?.state).toBe('OPEN');
    expect(db.getReadings('node-01')).toHaveLength(2);
    expect(db.getReadings('node-01')[0]?.severity).toBe('normal');
  });
  it('keeps absent legacy sensor measurements null', () => {
    ingestTelemetry(db, reading(1, { soilMoisturePct: undefined, waterLevelCm: undefined }));
    expect(db.getReadings('node-01')[0]).toMatchObject({
      soilMoisturePct: null,
      waterLevelCm: null,
    });
  });
  it('derives communication health from receipt time independently of environmental severity', () => {
    ingestTelemetry(db, reading(1, { temperatureC: 50 }));
    const received = Date.parse(db.getNode('node-01')!.lastReceivedAt!);
    expect(db.getNodes(received + 29999)[0]?.communicationHealth).toBe('online');
    expect(db.getNodes(received + 30000)[0]?.communicationHealth).toBe('stale');
    expect(db.getNodes(received + 120000)[0]).toMatchObject({
      communicationHealth: 'offline',
      status: 'alert',
    });
  });
  it('uses the supplied environment and rejects invalid port/topic settings', () => {
    expect(loadConfig({ PORT: '4100' }).port).toBe(4100);
    for (const value of ['0', '-1', '65536', '12junk', '1.2'])
      expect(() => loadConfig({ PORT: value })).toThrow();
    expect(() => loadConfig({ MQTT_TOPIC_PREFIX: 'a/+' })).toThrow();
  });
  it.each([
    'limit=1junk',
    'limit=1.5',
    'limit=5001',
    'limit=1&limit=2',
    'from=nope',
    'from=2026-02-01T00:00:00Z&to=2026-01-01T00:00:00Z',
    'bucketMs=NaN',
  ])('validates history query %s', async (query) => {
    ingestTelemetry(db, reading(1));
    expect(
      (
        await request(createApp(db, 'http://localhost:5173')).get(
          `/api/nodes/node-01/readings?${query}`,
        )
      ).status,
    ).toBe(400);
  });
  it('includes the full bounded source range for aggregation and aggregates only measured new sensors', async () => {
    for (let seq = 1; seq <= 501; seq++)
      ingestTelemetry(
        db,
        reading(seq, {
          temperatureC: seq === 1 ? 100 : 20,
          soilMoisturePct: seq === 1 ? 40 : undefined,
        }),
      );
    const result = await request(createApp(db, 'http://localhost:5173')).get(
      '/api/nodes/node-01/readings?bucketMs=86400000&limit=1',
    );
    expect(result.body[0].sampleCount).toBe(501);
    expect(result.body[0].temperatureC.max).toBe(100);
    expect(result.body[0].soilMoisturePct.avg).toBe(40);
  });
});

describe('persistent migrations', () => {
  it('preserves original rows, applies migration once, enables constraints and retains replay identity on reopen', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sahapul-db-'));
    const file = join(dir, 'test.sqlite');
    try {
      const legacy = new Database(file);
      legacy.exec(`CREATE TABLE nodes (node_id TEXT PRIMARY KEY,name TEXT NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,installed_at TEXT NOT NULL,last_seen_at TEXT,status TEXT NOT NULL DEFAULT 'normal');
        CREATE TABLE readings (id INTEGER PRIMARY KEY AUTOINCREMENT,node_id TEXT NOT NULL REFERENCES nodes(node_id),ts TEXT NOT NULL,temperature_c REAL NOT NULL,humidity_pct REAL NOT NULL,gas_ppm REAL NOT NULL,battery_pct REAL NOT NULL,lat REAL NOT NULL,lng REAL NOT NULL,severity TEXT NOT NULL DEFAULT 'normal');
        CREATE TABLE alerts (id INTEGER PRIMARY KEY AUTOINCREMENT,node_id TEXT NOT NULL REFERENCES nodes(node_id),ts TEXT NOT NULL,severity TEXT NOT NULL,metric TEXT NOT NULL,value REAL NOT NULL,threshold REAL NOT NULL,message TEXT NOT NULL);
        INSERT INTO nodes VALUES('legacy','Original station',0,0,'2025-01-01T00:00:00.000Z',NULL,'normal');
        INSERT INTO readings VALUES(1,'legacy','2025-01-01T00:00:00.000Z',22,50,10,90,0,0,'normal');`);
      legacy.close();
      let database = new DashboardDatabase(file);
      expect(database.getReadings('legacy')[0]).toMatchObject({
        id: 1,
        soilMoisturePct: null,
        waterLevelCm: null,
      });
      ingestTelemetry(database, reading(1));
      database.close();
      database = new DashboardDatabase(file);
      expect(ingestTelemetry(database, reading(1)).duplicate).toBe(true);
      expect(database.getNode('legacy')?.name).toBe('Original station');
      database.close();
      const raw = new Database(file);
      expect(raw.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(raw.pragma('user_version', { simple: true })).toBe(1);
      expect(() =>
        raw
          .prepare(
            "INSERT INTO readings(node_id,ts,temperature_c,humidity_pct,gas_ppm,battery_pct,lat,lng) VALUES ('missing','2026-01-01T00:00:00.000Z',20,50,1,90,0,0)",
          )
          .run(),
      ).toThrow();
      expect(() =>
        raw
          .prepare(
            "INSERT INTO readings(node_id,ts,temperature_c,humidity_pct,gas_ppm,battery_pct,lat,lng) VALUES ('legacy','2026-01-01T00:00:00.000Z',20,101,1,90,0,0)",
          )
          .run(),
      ).toThrow();
      raw.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
