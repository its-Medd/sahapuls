# Database schema and migrations

SQLite via better-sqlite3. Existing database files are preserved; initialization uses additive DDL and migration `PRAGMA user_version = 1`. No table is dropped or recreated. Take a backup before migrating a database containing valuable data. With the application stopped, preserve the SQLite file and any `-wal`/`-shm` files together; for a running database use SQLite's online backup tooling.

```powershell
# Run from repository root; DB_PATH is resolved from the server workspace.
npm run migrate --workspace server
```

The same idempotent migration runs automatically at backend startup. The script never clears data. A fixture representing the original schema is upgraded, reopened and checked by the regression suite.

| Table        | Fields / purpose                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| nodes        | node_id PK, original name, optional display_name override, lat/lng, installed_at, last_seen_at (device observation), last_received_at (server receipt), environmental status                    |
| readings     | id PK, node_id FK, canonical UTC ts, optional seq for legacy compatibility, temperature_c, humidity_pct, gas_ppm, battery_pct, lat/lng, severity, nullable soil_moisture_pct and water_level_cm |
| alerts       | id PK, node_id FK, ts (episode opening), severity, metric, value, threshold, message, state, updated_at, acknowledged_at, resolved_at                                                           |
| alert_events | id PK, alert_id FK, UTC ts, action OPEN / UPDATE / ACKNOWLEDGE / RESOLVE / REOPEN                                                                                                               |

Migration 1 adds columns, identity/state indexes, alert_events and insertion validation. Soil/water remain NULL on old rows. Old readings have NULL sequence; no deduplication identity is fabricated for them. Old alerts become OPEN because their original lifecycle is unknown. No historical alert_events are fabricated. Old nodes have no receive timestamp and show communication health `never` until a real message arrives.

The driver already enables foreign keys by default; initialization now explicitly enforces this requirement. WAL and a 5000ms busy timeout are configured. In-memory tests use SQLite's in-memory journal mode rather than WAL. Disk-backed migration tests verify WAL.

Readings have an index on (node_id, ts), plus a partial unique identity index on (node_id, ts, seq) where seq is not null. Alert state and event-history indexes support lifecycle queries. New sensor columns have CHECK ranges; an insertion trigger rejects out-of-range original sensors, coordinates, severity and invalid timestamps. Application Zod validation also enforces finite numeric values, safe sequences and valid identifiers. Existing rows are not silently rewritten to satisfy new constraints.

All values are parameterized. SQL fragments for optional query clauses come only from application-controlled constants. Device creation, alert lifecycle/history, reading insertion and device state updates share a transaction. A regression injects a write failure and verifies zero writes and zero socket emissions.

Historical queries normalize API dates to UTC and include both endpoints. Raw history returns the latest 500 by default, at most 5000, in chronological order. Aggregation reads up to 50000 source samples before computing nonempty UTC epoch-aligned buckets; larger ranges return 422 instead of silently truncating. Nullable metric aggregation counts only actual values for its statistics. sampleCount counts all readings in the bucket.

Current limitations: no retention/rollup scheduler, online backup endpoint, multi-process write coordination beyond SQLite locking, or automatic reconciliation of preexisting duplicate alert rows. See engineering-backlog.md.
