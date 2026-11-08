# Pre-submission audit — 2026-11-08

This is the state at the start of this improvement pass, not the original upstream checkout. The new brief's front/simulatoor workspace mismatch is stale: this working tree already contains web, server, simulator and mosquitto, with @sahapul package names and a generated npm workspace lock. npm ls --depth=0 resolves all workspaces and dependencies. The existing uncommitted modifications and untracked files are retained; Git is not reset, staged or committed.

The installed runtime is Node 22.19.0; system npm is 10.9.3. A local npm 11 runner will be used for requested verification without modifying the global installation. The broker, backend, simulator and Vite are running, and server/data contains an existing SQLite file and WAL. No user database will be cleared or recreated.

## Confirmed gaps and defects

| Location                                    | Finding                                                                                                            | Priority / planned action                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| package.json                                | No root dev command; four terminals are required                                                                   | Add a real supervised local-stack runner, safe around already-running services                          |
| server/src/app.ts                           | Only one generic health endpoint; no readiness or SQLite probe                                                     | Add distinct live/ready/combined status, with an optional simulator dependency                          |
| server/src/app.ts, realtime/socket.ts       | Default CORS allows localhost but the running dashboard uses 127.0.0.1; mutations from the latter are rejected     | Permit the exact configured origin and its same-port loopback alias; preserve external origin rejection |
| server/src/db/database.ts getLatestReadings | Correlated latest-reading subquery executes against each reading row                                               | Anchor the query to registered nodes and verify correct newest readings                                 |
| web/src/App.tsx                             | Devices has no search or condition/health filters                                                                  | Add reusable inventory filtering, clear/reset and explicit no-results states                            |
| web/src/App.tsx Analytics                   | Reuses the recent 500-point live chart; lacks time windows and min/avg/max                                         | Add a range-aware analytics view using backend aggregation and full-range statistics                    |
| web/src/App.tsx Overview                    | Online count exists, but stale/offline/open counts and activity are not distinguished                              | Add backend-derived health/alert counts and receipt-time device activity                                |
| web/src/App.tsx Settings                    | Shows browser/socket status but no database/MQTT/simulator/version summary                                         | Add a reusable read-only system status panel                                                            |
| web/src/index.css and navigation            | Small controls/metadata, inconsistent Unicode icons, no branded favicon                                            | Targeted typography, spacing, icon, touch target and responsive improvements                            |
| docs and attribution                        | Missing initial-audit.md, mqtt-protocol.md and THIRD_PARTY_NOTICES.md; screenshots do not cover all required views | Add factual documentation and actual before/after captures                                              |

## Existing core to preserve

MQTT identity validation, finite/ranged payload validation, message-size limits, transactional ingestion, after-commit events, replay identity, additive version-1 migration, soil/water null compatibility, alert hysteresis/cooldown/history/acknowledgment, receipt-time health, deterministic scenarios, live device discovery and REST/socket merging are already implemented. Existing tests and the three documented low-severity formatting exercises remain intact.

The saved prior security report contains seven moderate development-tool findings propagated from minimatch. Recheck the live advisory tree and make only a scoped, tested remediation. Production authentication, TLS, device ACLs, retention and physical radio integration remain outside this local synthetic-data scope.

The unchanged LICENSE identifies Alireza Ghaemitalab and the MIT grant. The configured Git remote is its-Medd/sahapuls. An upstream origin URL or separate permission correspondence has not been supplied; do not invent either. Record the evidence and attribution without publishing private details.
