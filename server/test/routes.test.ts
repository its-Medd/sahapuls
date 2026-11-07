import type { Express } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { DashboardDatabase } from '../src/db/database.js';
import { ingestTelemetry } from '../src/ingest.js';
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

describe('REST API', () => {
  let db: DashboardDatabase;
  let app: Express;

  beforeEach(() => {
    db = new DashboardDatabase(':memory:');
    db.upsertNode({
      nodeId: 'node-01',
      name: 'Ridge North',
      lat: 49.98,
      lng: -119.4,
      installedAt: reading().ts,
    });
    db.upsertNode({
      nodeId: 'node-02',
      name: 'Creek Basin',
      lat: 49.97,
      lng: -119.42,
      installedAt: reading().ts,
    });
    app = createApp(db, 'http://localhost:5173');
  });

  afterEach(() => {
    db.close();
  });

  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/nodes returns all known nodes', async () => {
    const res = await request(app).get('/api/nodes');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((n: { nodeId: string }) => n.nodeId).sort()).toEqual([
      'node-01',
      'node-02',
    ]);
  });

  it('GET /api/nodes/:nodeId returns a single node', async () => {
    const res = await request(app).get('/api/nodes/node-01');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Ridge North');
  });

  it('GET /api/nodes/:nodeId returns 404 for an unknown node', async () => {
    const res = await request(app).get('/api/nodes/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('GET /api/nodes/:nodeId/readings returns readings in chronological order', async () => {
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:02.000Z', temperatureC: 22 }));
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:01.000Z', temperatureC: 21 }));

    const res = await request(app).get('/api/nodes/node-01/readings');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].ts).toBe('2026-07-11T00:00:01.000Z');
    expect(res.body[1].ts).toBe('2026-07-11T00:00:02.000Z');
  });

  it('GET /api/nodes/:nodeId/readings with bucketMs returns aggregated buckets', async () => {
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:01.000Z', temperatureC: 10 }));
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:02.000Z', temperatureC: 30 }));

    const res = await request(app).get('/api/nodes/node-01/readings?bucketMs=60000');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].temperatureC).toEqual({ avg: 20, min: 10, max: 30 });
  });

  it('GET /api/nodes/:nodeId/readings rejects an invalid limit', async () => {
    const res = await request(app).get('/api/nodes/node-01/readings?limit=not-a-number');
    expect(res.status).toBe(400);
  });

  it('GET /api/alerts returns alerts raised by ingestTelemetry, most recent first', async () => {
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:01.000Z', temperatureC: 60 }));
    ingestTelemetry(db, reading({ ts: '2026-07-11T00:00:02.000Z', gasPpm: 500 }));

    const res = await request(app).get('/api/alerts');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].metric).toBe('gasPpm');
    expect(res.body[1].metric).toBe('temperatureC');
  });

  it('GET /api/alerts?nodeId= filters by node', async () => {
    ingestTelemetry(db, reading({ nodeId: 'node-02', temperatureC: 60 }));
    const res = await request(app).get('/api/alerts?nodeId=node-01');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('returns 404 json for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });
});
