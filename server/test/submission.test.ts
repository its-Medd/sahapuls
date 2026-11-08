import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { DashboardDatabase } from '../src/db/database.js';
import { createApp } from '../src/app.js';
import { ingestTelemetry } from '../src/ingest.js';
import { summarizeReadings } from '../src/alerts/aggregate.js';
import { isAllowedOrigin } from '../src/origins.js';
import type { SimulatorBridge } from '../src/simulator.js';
const sample = (seq: number, nodeId = 'n1', extra = {}) => ({
  nodeId,
  seq,
  ts: new Date(Date.UTC(2026, 0, 1) + seq * 1000).toISOString(),
  temperatureC: 22,
  humidityPct: 50,
  gasPpm: 10,
  batteryPct: 90,
  soilMoisturePct: 50,
  waterLevelCm: 60,
  lat: 0,
  lng: 0,
  simulatedAlert: false,
  ...extra,
});
describe('submission reliability and diagnostics', () => {
  let db: DashboardDatabase;
  beforeEach(() => {
    db = new DashboardDatabase(':memory:');
  });
  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });
  it('keeps liveness independent and reports readiness from SQLite and MQTT, with simulator optional', async () => {
    let connected = false;
    const app = createApp(db, 'http://localhost:5173', { mqttConnected: () => connected });
    expect((await request(app).get('/api/health/live')).body.status).toBe('alive');
    let ready = await request(app).get('/api/health/ready');
    expect(ready.status).toBe(503);
    expect(ready.body.components.sqlite).toMatchObject({
      status: 'up',
      schemaVersion: 1,
      foreignKeys: true,
    });
    expect(ready.body.components.mqtt.status).toBe('disconnected');
    expect(ready.body.components.simulator).toMatchObject({
      status: 'offline',
      requiredForReadiness: false,
    });
    connected = true;
    ready = await request(app).get('/api/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.ready).toBe(true);
    expect((await request(app).get('/api/health')).body).toMatchObject({
      application: 'SahaPul',
      status: 'ok',
      mqttConnected: true,
      version: '1.0.0',
    });
    vi.spyOn(db, 'getHealth').mockReturnValue({ status: 'down' });
    expect((await request(app).get('/api/health/live')).status).toBe(200);
    expect((await request(app).get('/api/health/ready')).status).toBe(503);
  });
  it('distinguishes a paused simulator from an offline simulator', async () => {
    const simulator: Pick<SimulatorBridge, 'getStatus' | 'command'> = {
      getStatus: () => ({ available: true, running: false, scenario: 'normal', intervalMs: 4000 }),
      command: vi.fn(),
    };
    const app = createApp(db, 'http://localhost:5173', { simulator, mqttConnected: () => true });
    const response = await request(app).get('/api/health');
    expect(response.body.components.simulator.status).toBe('paused');
    expect(response.body.ready).toBe(true);
  });
  it('allows same-port loopback browser reads/mutations and rejects unrelated hosts and ports', async () => {
    ingestTelemetry(db, sample(1));
    const app = createApp(db, 'http://localhost:5173');
    const read = await request(app).get('/api/nodes').set('Origin', 'http://127.0.0.1:5173');
    expect(read.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
    expect(
      (
        await request(app)
          .patch('/api/nodes/n1')
          .set('Origin', 'http://127.0.0.1:5173')
          .send({ name: 'Loopback station' })
      ).status,
    ).toBe(200);
    for (const origin of [
      'http://localhost:9999',
      'https://localhost:5173',
      'http://localhost.evil.test:5173',
      'null',
    ]) {
      expect(isAllowedOrigin(origin, 'http://localhost:5173')).toBe(false);
      expect(
        (await request(app).patch('/api/nodes/n1').set('Origin', origin).send({ name: 'Rejected' }))
          .status,
      ).toBe(403);
    }
    expect(isAllowedOrigin('http://127.0.0.1:5173', 'https://monitor.example')).toBe(false);
  });
  it('returns full-window source statistics including unequal bucket sizes and null measurements', async () => {
    ingestTelemetry(db, sample(1, 'n1', { temperatureC: 10, soilMoisturePct: 20 }));
    ingestTelemetry(db, sample(2, 'n1', { temperatureC: 20, soilMoisturePct: null }));
    ingestTelemetry(db, sample(61, 'n1', { temperatureC: 90, soilMoisturePct: undefined }));
    const result = await request(createApp(db, 'http://localhost:5173')).get(
      '/api/nodes/n1/analytics?bucketMs=60000',
    );
    expect(result.status).toBe(200);
    expect(result.body.sampleCount).toBe(3);
    expect(result.body.buckets).toHaveLength(2);
    expect(result.body.statistics.temperatureC).toEqual({ avg: 40, min: 10, max: 90, count: 3 });
    expect(result.body.statistics.soilMoisturePct).toEqual({ avg: 20, min: 20, max: 20, count: 1 });
    expect(summarizeReadings([]).waterLevelCm).toBeNull();
  });
  it('applies exact date endpoints, validates analytics filters and handles empty windows', async () => {
    ingestTelemetry(db, sample(1));
    ingestTelemetry(db, sample(2));
    const app = createApp(db, 'http://localhost:5173');
    const range = new URLSearchParams({ from: sample(1).ts, to: sample(1).ts, bucketMs: '1000' });
    expect((await request(app).get(`/api/nodes/n1/analytics?${range}`)).body.sampleCount).toBe(1);
    expect(
      (await request(app).get('/api/nodes/n1/analytics?from=2027-01-01T00:00:00Z')).body.statistics
        .temperatureC,
    ).toBeNull();
    for (const query of [
      'limit=1',
      'bucketMs=0',
      'from=nope',
      'from=2027-01-01T00:00:00Z&to=2026-01-01T00:00:00Z',
    ])
      expect((await request(app).get(`/api/nodes/n1/analytics?${query}`)).status).toBe(400);
    expect((await request(app).get('/api/nodes/absent/analytics')).status).toBe(404);
  });
  it('rejects an oversized analytics source rather than returning partial statistics', async () => {
    ingestTelemetry(db, sample(1));
    const row = db.getReadings('n1')[0]!;
    const rows = Array.from({ length: 50001 }, () => row);
    vi.spyOn(db, 'getReadings').mockReturnValue(rows);
    expect(
      (await request(createApp(db, 'http://localhost:5173')).get('/api/nodes/n1/analytics')).status,
    ).toBe(422);
  });
  it('selects one true latest reading per node including timestamp ties and late arrivals', () => {
    ingestTelemetry(db, sample(3));
    ingestTelemetry(db, sample(1));
    ingestTelemetry(db, sample(4, 'n1', { ts: sample(3).ts, temperatureC: 25 }));
    ingestTelemetry(db, sample(1, 'n2'));
    expect(db.getLatestReadings().map((reading) => [reading.nodeId, reading.temperatureC])).toEqual(
      [
        ['n1', 25],
        ['n2', 22],
      ],
    );
  });
});
