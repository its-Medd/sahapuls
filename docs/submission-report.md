# SahaPul pre-submission engineering report

Date: 2026-11-08. This report describes incremental changes to the existing working tree. No commits, pushes or history rewrites were made.

## Initial condition and preserved work

The brief's original directory mismatch had already been fixed: web, server, simulator and mosquitto existed, workspace dependencies resolved, and the previous engineering changes were still uncommitted. Those changes were preserved. The server held existing SQLite data (2604 readings at baseline) while the synthetic fleet continued running. The user database was not reset, recreated or migrated in this pass.

Existing MQTT identity/value validation, transactional ingestion, replay detection, version-1 migration, soil/water support, alert hysteresis/cooldown/history, independent device health, original scenarios and tests were retained. The original LICENSE and author notice remain unchanged.

## Defects found and root causes

1. Browser origin mismatch: default REST CORS accepted localhost while the running UI used 127.0.0.1. Live sockets could appear connected while REST failed. Fixed with shared exact-origin/loopback policy used by HTTP and Socket.IO; frontend defaults follow the browser loopback host.
2. Latest-reading performance: a correlated lookup ran per historical reading. The query now anchors to registered nodes and chooses one newest row per node, preserving timestamp/id tie order.
3. Pause action used unsaved form configuration: an invalid draft interval blocked pausing. Pause now uses the confirmed scenario/interval; start still validates the draft.
4. Root development startup was absent. A real supervised runner now starts/reuses the local stack, rejects unrelated HTTP port conflicts, and stops only owned services.
5. Startup reuse initially exposed a too-short timeout under concurrent test load. HTTP startup/reuse deadlines and cleanup were corrected, with an explicit ready assertion before test shutdown.
6. The keyboard skip link changed the hash to main-content, which the route resolver treated as Overview. It now focuses the main region without changing the active view; the browser regression verifies focus, heading and URL remain on Alerts.

## Backend, database and MQTT changes

Added /api/health/live, /api/health/ready and detailed /api/health. Readiness requires a successful SQLite probe and connected MQTT broker; simulator availability is optional. Version, journal mode, schema version and foreign-key status are actual probes. Startup/shutdown and MQTT connection state are logged.

Added bounded /api/nodes/:id/analytics with complete source-window statistics, per-metric measurement counts and bucketed averages. Means are calculated from source values rather than averaged bucket averages. More than 50000 samples returns 422, never truncated statistics. Summary distinguishes open and acknowledged counts. No schema/version change or historical measurement invention occurred.

The local runner uses IPC for orderly Windows service shutdown before a bounded fallback. MQTT reconnection, payload integrity and after-commit event behavior remain separate from HTTP handlers.

## Frontend and visual refinement

Preserved the ocean-blue/teal workstation identity and existing map/chart stack. Added consistent SVG navigation and favicon, Windows-capable display typography, tabular figures, 44px action targets, clearer metadata and responsive layouts. No decorative data or inactive actions were added.

DeviceInventory supplies name/ID search, health/condition filters, clear/reset, URL persistence and no-results recovery. Analytics adds device/range/metric selection and measured average/min/max/count. Overview adds stale/offline/open counts and recent receipt/battery activity. Settings displays separate service health and version. Existing alert and history/CSV flows remain functional.

Real before/after screenshots cover all seven views; captures use isolated synthetic test telemetry. Map failure is explicitly represented; third-party basemap availability is not fabricated.

## Dependency and environment changes

Node 22.19.0 and local npm 11.21.2 are used; the system npm 10 installation was not replaced. A scoped minimatch override resolves the previous seven moderate tooling entries. Current scan: zero reported vulnerabilities. Version-pinned npm 11 permissions allow only the existing SQLite/esbuild installers. CI and Docker builder commands select npm 11; Docker runtime execution remains unverified.

## Documentation and attribution

Updated README with the requested product subtitle, problem, actual architecture diagram, stack, real screenshots, structure, requirements, Windows/Docker commands, environment variables, protocol example, API, schema, tests, boundaries, limitations, roadmap and attribution. Added initial-audit.md, mqtt-protocol.md and THIRD_PARTY_NOTICES.md. Updated design/interaction contracts, technical audit, security review, testing record, backlog and retained exercise labels.

The original MIT license identifies Alireza Ghaemitalab and permits modification under its terms. The configured current repository is its-Medd/sahapuls; a distinct original upstream URL was not available and is not invented. No private authorization correspondence or contact details are included.

## Modified areas

- Root package/lock: dev runner, startup test, npm 11 metadata, scoped override and script approvals.
- scripts/dev.mjs, broker.mjs, tests/dev-runner.test.mjs: actual startup/reuse/cleanup.
- server/src/origins.ts, health.ts, app.ts, index.ts, realtime/socket.ts, mqtt/subscriber.ts: origin and lifecycle diagnostics.
- server/src/db/database.ts, routes/nodes.ts, alerts/aggregate.ts: latest query, source analytics, probes and counts.
- web/src/App.tsx, lib/api.ts/deviceFilters.ts, new inventory/activity/analytics/status/icon components, MetricChart, SimulatorControls, CSS and favicon: user workflows and visual refinement.
- New backend/component/browser tests; existing tests remain enabled.
- README, notices, design/UX contracts, docs, CI and Dockerfiles.

## Verification and limitations

Exact executed commands/results are in testing.md, with the current machine-readable dependency report. Workspace tests, actual MQTT/Socket.IO transport tests, startup integration, build/type/lint/format checks and browser workflows are exercised. No remote CI run is claimed.

Compose config validates. Actual up --build was attempted and failed because the Docker engine named pipe is missing. No Mosquitto/container startup, image scan, physical sensor operation, long-duration soak, full screen-reader or multi-browser certification is claimed. Accessibility scans exclude the third-party Leaflet surface and retain a keyboard station-list alternative.

## Known low-severity defects and future work

Three genuine pre-existing issues remain as labeled exercises in open-bug-tasks.md: early relative-time rounding, invalid relative-time fallback, and date-less multi-day overview chart labels. They do not break installation, persistence, core tests or security. The Analytics view uses date-aware ticks separately.

Future deployment work includes authentication/TLS/device ACLs, quotas, backup/retention, container/Mosquitto verification, Recharts migration and broader browser/soak coverage. These are not presented as completed features.

## Startup

From the repository root: npm install, then npm run dev. Open http://127.0.0.1:5173/. Workspace watch-mode alternatives remain dev:broker, dev:server, dev:simulator and dev:web in separate terminals. No publication, commit or push was performed.
