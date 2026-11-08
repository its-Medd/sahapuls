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
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
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
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version > 1) throw new Error('Database schema is newer than this application');
  if (version < 1) {
    db.transaction(() => {
      db.exec(`
        ALTER TABLE nodes ADD COLUMN last_received_at TEXT;
        ALTER TABLE nodes ADD COLUMN display_name TEXT;
        ALTER TABLE readings ADD COLUMN seq INTEGER CHECK(seq >= 0);
        ALTER TABLE readings ADD COLUMN soil_moisture_pct REAL CHECK(soil_moisture_pct BETWEEN 0 AND 100);
        ALTER TABLE readings ADD COLUMN water_level_cm REAL CHECK(water_level_cm BETWEEN 0 AND 100000);
        ALTER TABLE alerts ADD COLUMN state TEXT NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','ACKNOWLEDGED','RESOLVED'));
        ALTER TABLE alerts ADD COLUMN updated_at TEXT;
        ALTER TABLE alerts ADD COLUMN acknowledged_at TEXT;
        ALTER TABLE alerts ADD COLUMN resolved_at TEXT;
        UPDATE alerts SET updated_at = ts;
        CREATE UNIQUE INDEX idx_readings_identity ON readings(node_id, ts, seq) WHERE seq IS NOT NULL;
        CREATE INDEX idx_alerts_state ON alerts(node_id, metric, state, updated_at);
        CREATE TABLE alert_events (
          id INTEGER PRIMARY KEY,
          alert_id INTEGER NOT NULL REFERENCES alerts(id),
          ts TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('OPEN','UPDATE','ACKNOWLEDGE','RESOLVE','REOPEN'))
        );
        CREATE INDEX idx_alert_events ON alert_events(alert_id, id);
        CREATE TRIGGER validate_reading_insert BEFORE INSERT ON readings
        WHEN NEW.temperature_c NOT BETWEEN -100 AND 150
          OR NEW.humidity_pct NOT BETWEEN 0 AND 100
          OR NEW.battery_pct NOT BETWEEN 0 AND 100
          OR NEW.gas_ppm NOT BETWEEN 0 AND 1000000
          OR NEW.lat NOT BETWEEN -90 AND 90 OR NEW.lng NOT BETWEEN -180 AND 180
          OR NEW.severity NOT IN ('normal','warning','alert')
          OR strftime('%Y-%m-%dT%H:%M:%fZ', NEW.ts) IS NULL
        BEGIN SELECT RAISE(ABORT, 'invalid reading'); END;
        PRAGMA user_version = 1;
      `);
    })();
  }
}
