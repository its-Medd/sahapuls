import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { migrate } from './schema.js';
import type {
  AlertEvent,
  AlertRecord,
  AlertState,
  NodeMeta,
  NodeRecord,
  ReadingRecord,
  Severity,
  TelemetryReading,
} from '../types.js';

type AlertInput = Pick<
  AlertRecord,
  'nodeId' | 'ts' | 'severity' | 'metric' | 'value' | 'threshold' | 'message'
>;
export class DashboardDatabase {
  private readonly db: Database.Database;
  constructor(dbPath: string) {
    if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    try {
      migrate(this.db);
    } catch (error) {
      this.db.close();
      throw error;
    }
  }
  close(): void {
    this.db.close();
  }
  getHealth(): {
    status: 'up' | 'down';
    schemaVersion?: number;
    journalMode?: string;
    foreignKeys?: boolean;
    engine?: string;
  } {
    try {
      this.db.prepare('SELECT 1').get();
      return {
        status: 'up',
        schemaVersion: this.db.pragma('user_version', { simple: true }) as number,
        journalMode: this.db.pragma('journal_mode', { simple: true }) as string,
        foreignKeys: this.db.pragma('foreign_keys', { simple: true }) === 1,
        engine: (this.db.prepare('SELECT sqlite_version() AS version').get() as { version: string })
          .version,
      };
    } catch {
      return { status: 'down' };
    }
  }
  transaction<T>(operation: () => T): T {
    return this.db.transaction(operation)();
  }
  upsertNode(meta: NodeMeta): void {
    this.db
      .prepare(
        `INSERT INTO nodes (node_id, name, lat, lng, installed_at, status)
      VALUES (@nodeId, @name, @lat, @lng, @installedAt, 'normal')
      ON CONFLICT(node_id) DO UPDATE SET name=excluded.name, lat=excluded.lat, lng=excluded.lng`,
      )
      .run(meta);
  }
  renameNode(nodeId: string, name: string): NodeRecord | undefined {
    this.db.prepare('UPDATE nodes SET display_name = ? WHERE node_id = ?').run(name, nodeId);
    return this.getNode(nodeId);
  }
  findReading(reading: TelemetryReading): ReadingRecord | undefined {
    const row = this.db
      .prepare('SELECT * FROM readings WHERE node_id=? AND ts=? AND seq=?')
      .get(reading.nodeId, reading.ts, reading.seq) as RawReadingRow | undefined;
    return row ? mapReadingRow(row) : undefined;
  }
  insertReading(reading: TelemetryReading, severity: Severity): ReadingRecord {
    const info = this.db
      .prepare(
        `INSERT INTO readings
      (node_id, ts, seq, temperature_c, humidity_pct, gas_ppm, battery_pct, lat, lng, severity, soil_moisture_pct, water_level_cm)
      VALUES (@nodeId,@ts,@seq,@temperatureC,@humidityPct,@gasPpm,@batteryPct,@lat,@lng,@severity,@soilMoisturePct,@waterLevelCm)`,
      )
      .run({
        ...reading,
        soilMoisturePct: reading.soilMoisturePct ?? null,
        waterLevelCm: reading.waterLevelCm ?? null,
        severity,
      });
    this.db
      .prepare(
        `UPDATE nodes SET last_received_at=@received,
      status=CASE WHEN last_seen_at IS NULL OR last_seen_at<=@ts THEN @severity ELSE status END,
      last_seen_at=CASE WHEN last_seen_at IS NULL OR last_seen_at<=@ts THEN @ts ELSE last_seen_at END
      WHERE node_id=@nodeId`,
      )
      .run({
        nodeId: reading.nodeId,
        ts: reading.ts,
        severity,
        received: new Date().toISOString(),
      });
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
      soilMoisturePct: reading.soilMoisturePct ?? null,
      waterLevelCm: reading.waterLevelCm ?? null,
    };
  }
  setNodeSeverity(nodeId: string, severity: Severity): void {
    this.db.prepare('UPDATE nodes SET status=? WHERE node_id=?').run(severity, nodeId);
  }
  insertAlert(alert: AlertInput): AlertRecord {
    const info = this.db
      .prepare(
        `INSERT INTO alerts
      (node_id,ts,severity,metric,value,threshold,message,state,updated_at)
      VALUES (@nodeId,@ts,@severity,@metric,@value,@threshold,@message,'OPEN',@ts)`,
      )
      .run(alert);
    const id = Number(info.lastInsertRowid);
    this.addAlertEvent(id, alert.ts, 'OPEN');
    return this.getAlert(id)!;
  }
  getAlert(id: number): AlertRecord | undefined {
    const row = this.db.prepare('SELECT * FROM alerts WHERE id=?').get(id) as
      RawAlertRow | undefined;
    return row ? mapAlertRow(row) : undefined;
  }
  updateAlert(
    id: number,
    changes: Pick<AlertRecord, 'severity' | 'value' | 'threshold' | 'message' | 'state'>,
    ts: string,
    action?: AlertEvent['action'],
  ): AlertRecord {
    this.db
      .prepare(
        `UPDATE alerts SET severity=@severity,value=@value,threshold=@threshold,message=@message,state=@state,
      updated_at=@ts,
      acknowledged_at=CASE WHEN @state='ACKNOWLEDGED' THEN COALESCE(acknowledged_at,@ts) WHEN @state='OPEN' THEN NULL ELSE acknowledged_at END,
      resolved_at=CASE WHEN @state='RESOLVED' THEN @ts ELSE NULL END WHERE id=@id`,
      )
      .run({ ...changes, id, ts });
    if (action) this.addAlertEvent(id, ts, action);
    return this.getAlert(id)!;
  }
  acknowledgeAlert(id: number): AlertRecord | undefined {
    return this.transaction(() => {
      const alert = this.getAlert(id);
      if (!alert || alert.state !== 'OPEN') return alert;
      return this.updateAlert(
        id,
        { ...alert, state: 'ACKNOWLEDGED' },
        new Date().toISOString(),
        'ACKNOWLEDGE',
      );
    });
  }
  private addAlertEvent(id: number, ts: string, action: AlertEvent['action']): void {
    this.db
      .prepare('INSERT INTO alert_events(alert_id,ts,action) VALUES (?,?,?)')
      .run(id, ts, action);
  }
  getAlertEvents(id: number): AlertEvent[] {
    return this.db
      .prepare(
        'SELECT id, alert_id AS alertId, ts, action FROM alert_events WHERE alert_id=? ORDER BY id',
      )
      .all(id) as AlertEvent[];
  }
  getNodes(now = Date.now()): NodeRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM nodes ORDER BY COALESCE(display_name,name),node_id')
        .all() as RawNodeRow[]
    ).map((row) => mapNodeRow(row, now));
  }
  getNode(nodeId: string): NodeRecord | undefined {
    const row = this.db.prepare('SELECT * FROM nodes WHERE node_id=?').get(nodeId) as
      RawNodeRow | undefined;
    return row ? mapNodeRow(row) : undefined;
  }
  getReadings(
    nodeId: string,
    options: { from?: string; to?: string; limit?: number } = {},
  ): ReadingRecord[] {
    const conditions = ['node_id=@nodeId'];
    const params: Record<string, unknown> = { nodeId, limit: options.limit ?? 500 };
    if (options.from) {
      conditions.push('ts>=@from');
      params.from = options.from;
    }
    if (options.to) {
      conditions.push('ts<=@to');
      params.to = options.to;
    }
    return (
      this.db
        .prepare(
          `SELECT * FROM readings WHERE ${conditions.join(' AND ')} ORDER BY ts DESC,id DESC LIMIT @limit`,
        )
        .all(params) as RawReadingRow[]
    )
      .map(mapReadingRow)
      .reverse();
  }
  getLatestReadings(): ReadingRecord[] {
    return (
      this.db
        .prepare(
          `SELECT r.* FROM nodes n JOIN readings r ON r.id = (
      SELECT id FROM readings WHERE node_id=n.node_id ORDER BY ts DESC,id DESC LIMIT 1) ORDER BY n.node_id`,
        )
        .all() as RawReadingRow[]
    ).map(mapReadingRow);
  }
  getAlerts(options: { nodeId?: string; limit?: number; state?: AlertState } = {}): AlertRecord[] {
    const conditions: string[] = [];
    const params: Record<string, unknown> = { limit: options.limit ?? 100 };
    if (options.nodeId) {
      conditions.push('node_id=@nodeId');
      params.nodeId = options.nodeId;
    }
    if (options.state) {
      conditions.push('state=@state');
      params.state = options.state;
    }
    return (
      this.db
        .prepare(
          `SELECT * FROM alerts ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''}
      ORDER BY ts DESC,id DESC LIMIT @limit`,
        )
        .all(params) as RawAlertRow[]
    ).map(mapAlertRow);
  }
  getMetricAlerts(nodeId: string, metric: string): AlertRecord[] {
    return (
      this.db
        .prepare('SELECT * FROM alerts WHERE node_id=? AND metric=? ORDER BY id DESC')
        .all(nodeId, metric) as RawAlertRow[]
    ).map(mapAlertRow);
  }
  getSummary(): {
    readingCount: number;
    activeAlerts: number;
    openAlerts: number;
    acknowledgedAlerts: number;
    latestReadings: ReadingRecord[];
  } {
    return {
      readingCount: (
        this.db.prepare('SELECT COUNT(*) AS count FROM readings').get() as { count: number }
      ).count,
      activeAlerts: (
        this.db.prepare("SELECT COUNT(*) AS count FROM alerts WHERE state!='RESOLVED'").get() as {
          count: number;
        }
      ).count,
      latestReadings: this.getLatestReadings(),
      openAlerts: (
        this.db.prepare("SELECT COUNT(*) AS count FROM alerts WHERE state='OPEN'").get() as {
          count: number;
        }
      ).count,
      acknowledgedAlerts: (
        this.db
          .prepare("SELECT COUNT(*) AS count FROM alerts WHERE state='ACKNOWLEDGED'")
          .get() as { count: number }
      ).count,
    };
  }
}
interface RawNodeRow {
  node_id: string;
  name: string;
  display_name: string | null;
  lat: number;
  lng: number;
  installed_at: string;
  last_seen_at: string | null;
  last_received_at: string | null;
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
  soil_moisture_pct: number | null;
  water_level_cm: number | null;
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
  state: AlertState;
  updated_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
}
function mapNodeRow(row: RawNodeRow, now = Date.now()): NodeRecord {
  const age = row.last_received_at ? Math.max(0, now - Date.parse(row.last_received_at)) : Infinity;
  return {
    nodeId: row.node_id,
    name: row.display_name ?? row.name,
    lat: row.lat,
    lng: row.lng,
    installedAt: row.installed_at,
    lastSeenAt: row.last_seen_at,
    status: row.status,
    lastReceivedAt: row.last_received_at,
    communicationHealth: !row.last_received_at
      ? 'never'
      : age >= 120_000
        ? 'offline'
        : age >= 30_000
          ? 'stale'
          : 'online',
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
    soilMoisturePct: row.soil_moisture_pct,
    waterLevelCm: row.water_level_cm,
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
    state: row.state,
    updatedAt: row.updated_at ?? row.ts,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
  };
}
