import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './schema.js';
import type {
  AlertRecord,
  NodeMeta,
  NodeRecord,
  ReadingRecord,
  Severity,
  TelemetryReading,
} from '../types.js';

export class DashboardDatabase {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    migrate(this.db);
  }

  close(): void {
    this.db.close();
  }

  upsertNode(meta: NodeMeta): void {
    this.db
      .prepare(
        `INSERT INTO nodes (node_id, name, lat, lng, installed_at, status)
         VALUES (@nodeId, @name, @lat, @lng, @installedAt, 'normal')
         ON CONFLICT(node_id) DO UPDATE SET name = excluded.name, lat = excluded.lat, lng = excluded.lng`,
      )
      .run(meta);
  }

  insertReading(reading: TelemetryReading, severity: Severity): ReadingRecord {
    const info = this.db
      .prepare(
        `INSERT INTO readings (node_id, ts, temperature_c, humidity_pct, gas_ppm, battery_pct, lat, lng, severity)
         VALUES (@nodeId, @ts, @temperatureC, @humidityPct, @gasPpm, @batteryPct, @lat, @lng, @severity)`,
      )
      .run({ ...reading, severity });

    this.db
      .prepare(`UPDATE nodes SET last_seen_at = ?, status = ? WHERE node_id = ?`)
      .run(reading.ts, severity, reading.nodeId);

    return {
      id: Number(info.lastInsertRowid),
      nodeId: reading.nodeId,
      ts: reading.ts,
      temperatureC: reading.temperatureC,
      humidityPct: reading.humidityPct,
      gasPpm: reading.gasPpm,
      batteryPct: reading.batteryPct,
      lat: reading.lat,
      lng: reading.lng,
      severity,
    };
  }

  insertAlert(alert: Omit<AlertRecord, 'id'>): AlertRecord {
    const info = this.db
      .prepare(
        `INSERT INTO alerts (node_id, ts, severity, metric, value, threshold, message)
         VALUES (@nodeId, @ts, @severity, @metric, @value, @threshold, @message)`,
      )
      .run(alert);
    return { id: Number(info.lastInsertRowid), ...alert };
  }

  getNodes(): NodeRecord[] {
    const rows = this.db.prepare(`SELECT * FROM nodes ORDER BY name ASC`).all() as RawNodeRow[];
    return rows.map(mapNodeRow);
  }

  getNode(nodeId: string): NodeRecord | undefined {
    const row = this.db.prepare(`SELECT * FROM nodes WHERE node_id = ?`).get(nodeId) as
      RawNodeRow | undefined;
    return row ? mapNodeRow(row) : undefined;
  }

  getReadings(
    nodeId: string,
    options: { from?: string; to?: string; limit?: number } = {},
  ): ReadingRecord[] {
    const conditions = ['node_id = @nodeId'];
    const params: Record<string, unknown> = { nodeId, limit: options.limit ?? 500 };

    if (options.from) {
      conditions.push('ts >= @from');
      params.from = options.from;
    }
    if (options.to) {
      conditions.push('ts <= @to');
      params.to = options.to;
    }

    const rows = this.db
      .prepare(
        `SELECT * FROM readings WHERE ${conditions.join(' AND ')} ORDER BY ts DESC LIMIT @limit`,
      )
      .all(params) as RawReadingRow[];

    return rows.map(mapReadingRow).reverse();
  }

  getAlerts(options: { nodeId?: string; limit?: number } = {}): AlertRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit: options.limit ?? 100 };

    if (options.nodeId) {
      conditions.push('node_id = @nodeId');
      params.nodeId = options.nodeId;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM alerts ${where} ORDER BY ts DESC LIMIT @limit`)
      .all(params) as RawAlertRow[];

    return rows.map(mapAlertRow);
  }
}

interface RawNodeRow {
  node_id: string;
  name: string;
  lat: number;
  lng: number;
  installed_at: string;
  last_seen_at: string | null;
  status: Severity;
}

interface RawReadingRow {
  id: number;
  node_id: string;
  ts: string;
  temperature_c: number;
  humidity_pct: number;
  gas_ppm: number;
  battery_pct: number;
  lat: number;
  lng: number;
  severity: Severity;
}

interface RawAlertRow {
  id: number;
  node_id: string;
  ts: string;
  severity: AlertRecord['severity'];
  metric: AlertRecord['metric'];
  value: number;
  threshold: number;
  message: string;
}

function mapNodeRow(row: RawNodeRow): NodeRecord {
  return {
    nodeId: row.node_id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    installedAt: row.installed_at,
    lastSeenAt: row.last_seen_at,
    status: row.status,
  };
}

function mapReadingRow(row: RawReadingRow): ReadingRecord {
  return {
    id: row.id,
    nodeId: row.node_id,
    ts: row.ts,
    temperatureC: row.temperature_c,
    humidityPct: row.humidity_pct,
    gasPpm: row.gas_ppm,
    batteryPct: row.battery_pct,
    lat: row.lat,
    lng: row.lng,
    severity: row.severity,
  };
}

function mapAlertRow(row: RawAlertRow): AlertRecord {
  return {
    id: row.id,
    nodeId: row.node_id,
    ts: row.ts,
    severity: row.severity,
    metric: row.metric,
    value: row.value,
    threshold: row.threshold,
    message: row.message,
  };
}
