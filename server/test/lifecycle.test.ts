import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { DashboardDatabase } from '../src/db/database.js';
import { ingestTelemetry } from '../src/ingest.js';
import { createApp } from '../src/app.js';
import type { TelemetryReading } from '../src/types.js';
const sample = (seq: number, temperatureC = 22, extra: Partial<TelemetryReading> = {}) => ({
  nodeId: 'n1',
  seq,
  ts: new Date(Date.UTC(2026, 0, 1) + seq * 1000).toISOString(),
  temperatureC,
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
describe('alert lifecycle', () => {
  let db: DashboardDatabase;
  beforeEach(() => {
    db = new DashboardDatabase(':memory:');
  });
  afterEach(() => db.close());
  it('deduplicates sustained breaches and records acknowledgment idempotently', async () => {
    ingestTelemetry(db, sample(1, 36));
    ingestTelemetry(db, sample(2, 37));
    expect(db.getAlerts()).toHaveLength(1);
    const id = db.getAlerts()[0]!.id;
    const app = createApp(db, 'http://localhost:5173');
    expect((await request(app).post(`/api/alerts/${id}/acknowledge`)).body.state).toBe(
      'ACKNOWLEDGED',
    );
    await request(app).post(`/api/alerts/${id}/acknowledge`);
    ingestTelemetry(db, sample(3, 36));
    expect(db.getAlert(id)?.state).toBe('ACKNOWLEDGED');
    expect(db.getAlertEvents(id).map((e) => e.action)).toEqual(['OPEN', 'ACKNOWLEDGE']);
  });
  it('escalates immediately, requires review again, and holds critical severity through hysteresis', () => {
    ingestTelemetry(db, sample(1, 35));
    const id = db.getAlerts()[0]!.id;
    db.acknowledgeAlert(id);
    ingestTelemetry(db, sample(2, 45));
    expect(db.getAlert(id)).toMatchObject({ severity: 'alert', state: 'OPEN' });
    ingestTelemetry(db, sample(3, 44));
    expect(db.getNode('n1')?.status).toBe('alert');
    ingestTelemetry(db, sample(4, 43));
    expect(db.getNode('n1')?.status).toBe('warning');
    ingestTelemetry(db, sample(5, 34));
    expect(db.getAlert(id)?.state).toBe('OPEN');
    ingestTelemetry(db, sample(6, 33));
    expect(db.getAlert(id)?.state).toBe('RESOLVED');
    expect(db.getNode('n1')?.status).toBe('normal');
  });
  it('reopens the episode inside cooldown and creates a new episode at the exact cooldown boundary', () => {
    ingestTelemetry(db, sample(1, 36));
    const id = db.getAlerts()[0]!.id;
    ingestTelemetry(db, sample(2, 32));
    ingestTelemetry(db, sample(3, 36));
    expect(db.getAlerts()).toHaveLength(1);
    expect(db.getAlertEvents(id).at(-1)?.action).toBe('REOPEN');
    ingestTelemetry(db, sample(4, 32));
    ingestTelemetry(db, sample(64, 36));
    expect(db.getAlerts()).toHaveLength(2);
  });
  it('applies inverted thresholds and recovery margins for soil, water and battery', () => {
    ingestTelemetry(db, sample(1, 22, { soilMoisturePct: 15, waterLevelCm: 10, batteryPct: 10 }));
    expect(db.getAlerts()).toHaveLength(3);
    ingestTelemetry(db, sample(2, 22, { soilMoisturePct: 27, waterLevelCm: 22, batteryPct: 21 }));
    expect(db.getAlerts().every((a) => a.state === 'OPEN')).toBe(true);
    ingestTelemetry(db, sample(3, 22, { soilMoisturePct: 28, waterLevelCm: 23, batteryPct: 22 }));
    expect(db.getAlerts().every((a) => a.state === 'RESOLVED')).toBe(true);
  });
  it('does not interpret a missing sensor as recovery', () => {
    ingestTelemetry(db, sample(1, 22, { soilMoisturePct: 10 }));
    ingestTelemetry(db, sample(2, 22, { soilMoisturePct: undefined }));
    expect(db.getAlerts()[0]?.state).toBe('OPEN');
    expect(db.getNode('n1')?.status).toBe('alert');
  });
  it('serves history, rejects acknowledgment after recovery and disallows cross-origin mutations', async () => {
    ingestTelemetry(db, sample(1, 45));
    const id = db.getAlerts()[0]!.id;
    ingestTelemetry(db, sample(2, 20));
    const app = createApp(db, 'http://localhost:5173');
    const history = await request(app).get(`/api/alerts/${id}/history`);
    expect(history.body.map((e: { action: string }) => e.action)).toEqual(['OPEN', 'RESOLVE']);
    expect((await request(app).post(`/api/alerts/${id}/acknowledge`)).status).toBe(409);
    expect(
      (
        await request(app)
          .patch('/api/nodes/n1')
          .set('Origin', 'https://example.net')
          .send({ name: 'Changed' })
      ).status,
    ).toBe(403);
    expect((await request(app).patch('/api/nodes/n1').send({ name: 'Renamed' })).body.name).toBe(
      'Renamed',
    );
  });
});
