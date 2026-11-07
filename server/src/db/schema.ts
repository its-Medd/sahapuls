import type Database from 'better-sqlite3';

/**
 * Schema notes: SQLite was chosen over Postgres/TimescaleDB for this demo to
 * keep `docker compose up` down to two containers (broker + backend) with no
 * separate database service to provision, back up, or tune. The `readings`
 * table is still laid out in a time-series-friendly way - append-only rows
 * keyed by (node_id, ts) with a covering index - so the query patterns here
 * (latest reading per node, time-range scans per node) translate directly to
 * a Postgres + TimescaleDB hypertable if this ever needed to scale past a
 * single-file database (see README "Scaling this further").
 */
export function migrate(db: Database.Database): void {
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      node_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      installed_at TEXT NOT NULL,
      last_seen_at TEXT,
      status TEXT NOT NULL DEFAULT 'normal'
    );

    CREATE TABLE IF NOT EXISTS readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL REFERENCES nodes(node_id),
      ts TEXT NOT NULL,
      temperature_c REAL NOT NULL,
      humidity_pct REAL NOT NULL,
      gas_ppm REAL NOT NULL,
      battery_pct REAL NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      severity TEXT NOT NULL DEFAULT 'normal'
    );
    CREATE INDEX IF NOT EXISTS idx_readings_node_ts ON readings(node_id, ts);

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL REFERENCES nodes(node_id),
      ts TEXT NOT NULL,
      severity TEXT NOT NULL,
      metric TEXT NOT NULL,
      value REAL NOT NULL,
      threshold REAL NOT NULL,
      message TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_node_ts ON alerts(node_id, ts);
  `);
}
