# Verification record — 2026-11-08

Local environment: Windows, Node **22.19.0**, repository-local npm **11.21.2**. The global npm 10.9.3 installation was not replaced. For final commands, the local npm 11 CLI and its bin directory were selected explicitly so nested npm scripts also use npm 11. The system's exact Windows edition was not independently certified.

## Executed results

| Command / check                        | Actual result                                                                                                           |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| npm install (npm 11)                   | Exit 0, 557 packages audited, zero reported vulnerabilities; explicit SQLite/esbuild script permissions recorded        |
| npm ls --all --json                    | Exit 0; no unmet/invalid dependency entries                                                                             |
| npm run                                | Exit 0; real dev, workspace, build/lint/test/type/format, browser and startup scripts listed                            |
| npm test                               | Exit 0: simulator **28**, backend **91**, frontend **21**, plus **1** root startup integration test — **141 passed**    |
| npm run lint                           | Workspace lint passes with zero warnings allowed; final verification repeated after formatting                          |
| npm run typecheck                      | Every workspace's TypeScript check is executed; build also typechecks production sources                                |
| npm run build                          | All workspaces compile; map and chart remain separate lazy-loaded chunks                                                |
| npm run format:check                   | Executed after the final formatter pass                                                                                 |
| npm run test:e2e                       | Exit 0: **10 browser tests passed**, including the seven-view screenshot/axe pass; latest run completed in 45.0 seconds |
| npm run test:startup                   | Exit 0 separately; final root test pass completed startup/reuse/shutdown in about 15.3 seconds                          |
| npm audit --json                       | Exit 0: zero low, moderate, high or critical findings; saved in dependency-audit.json                                   |
| strict UI contract audit               | Exit 0, zero findings; premium-audit.json                                                                               |
| designmd lint DESIGN.md                | Exit 0, zero errors/warnings, using the cached offline validator                                                        |
| standalone Compose config --quiet      | Exit 0                                                                                                                  |
| standalone Compose up --build --detach | Exit 1, Docker engine named pipe unavailable; no container-start success claimed                                        |
| git diff --exit-code -- LICENSE        | Exit 0, original MIT attribution unchanged                                                                              |

The exact workspace test totals are 28 + 91 + 21 = 140; the root process-lifecycle test brings npm test to 141. Original tests remain enabled. Three tests characterize the explicitly retained formatting exercises rather than declaring their behavior desirable.

## Test coverage

Backend: MQTT topic/payload identity, byte/range/date validation, retransmission identity, rollback and after-commit emission, late readings, old-schema preservation, WAL/foreign keys, bounded queries, original thresholds, lifecycle acknowledgment/escalation/recovery/hysteresis/cooldown, history and Socket.IO delivery. New submission tests cover separate liveness/readiness, optional paused simulator, SQLite failure response, loopback/external Origin policy, complete source-weighted statistics, nullable sample counts, inclusive ranges, oversized windows and latest-reading tie/late ordering.

Two actual MQTT transport tests use Aedes: retained metadata/spoof rejection/replay, and a real broker restart followed by resubscription without accumulated message handlers or duplicate rows. These are not mocked transports.

Simulator: original virtual-node episodes/random helpers plus deterministic scenario values/ranges, configuration bounds, start/stop/timer ownership and no overlapping publishing ticks.

Frontend: original components/formatting helpers, REST/socket race reconciliation, arriving devices, cleanup and errors, plus combined inventory search/health/condition filters, clear/reset/focus and no-results behavior.

Root runner: starts an isolated real broker/backend/simulator/Vite stack; checks readiness and observations; starts a second runner that reuses the stack; verifies stopping that runner leaves services available; finally shuts down only the owning runner's processes and confirms SQLite closure. Temporary databases and ports 18888/4028/5188 are separate from user data.

## Browser verification and screenshots

Playwright starts compiled backend/simulator, Aedes and Vite on isolated ports 18883/4018/5178 with a fresh temporary database. Windows Edge is used when installed, otherwise Playwright Chromium. The ten tests exercise:

1. Full simulator → MQTT → backend → SQLite → alerts → Socket.IO → dashboard lifecycle, with acknowledgment, recovery and pause.
2. Device naming validation, navigation-safe drafts and persisted rename.
3. History CSV download, all-view 390px navigation, preference and wide/narrow screenshots.
4. HTTP failure, retry, delayed loading and empty history.
5. New realtime device arrival, spoof rejection, browser offline and reconnect.
6. Settings/Alerts axe scan, reduced motion, keyboard skip link and focus.
7. Search/filter/clear/reset inventory results.
8. Backend analytics statistics, time/metric filters and empty-window recovery.
9. Pause with an invalid unsaved interval; confirmed publishing interval remains intact.
10. Live diagnostic values, all seven desktop views, actual screenshots and configured axe checks.

Before screenshots are retained under docs/screenshots/before-submission. New captures include overview/devices/analytics/alerts/history/simulator/settings desktop views and mobile captures. They are real UI captures with synthetic telemetry. The browser could not rely on external map tiles; a deliberate tile-abort case verifies the labeled fallback. The Leaflet surface is excluded from the all-view axe scan; this is not full WCAG or screen-reader certification.

## Failures found and resolved during this pass

The first capture exposed real REST failures from the localhost/127.0.0.1 mismatch, while sockets still delivered nodes. The shared origin policy and same-host API default fix this.

An initial override install did not reify the old nested minimatch entry; npm ls correctly reported it invalid. A targeted npm 11 update regenerated the lock and the final tree/audit is clean. Npm 11's native build permissions were reviewed and pinned instead of broadly enabling scripts.

The first root runner smoke test passed alone but a reuse check failed under concurrent compilation load: its 1s HTTP timeout could close the child before the test's shutdown message. Request/startup bounds, readiness assertions and cleanup were corrected. Subsequent standalone and full npm test runs passed. Tests were not disabled or given false success outputs.

## Persistent-data evidence and limitations

The normal server database contained 2604 readings at baseline and 5010 at a later live check while the fleet continued publishing. Health reported schema version 1, WAL, enforced foreign keys and MQTT connected. No user record deletion, database recreation or new migration was performed. Tests exclusively create/clean their own temporary fixtures.

Docker config is valid, but the engine is not running; Mosquitto/container builds, image security, volume permissions and Docker startup remain unverified. CI was updated to npm 11 and startup/browser checks, but nothing was pushed and no remote job was run. No physical hardware, long-duration soak, full screen-reader, Firefox/Safari or public deployment certification was performed.

## Requested quick follow-up check

On 2026-11-08, the focused regression run passed 24 backend tests (MQTT parsing, ingestion and alert lifecycle) plus all three retained-defect characterization tests: **27 passed**. The pending browser run finished with **10 passed**, including the corrected skip-link route assertion. The existing /api/health/ready response reported ready=true, SQLite up with foreign keys enforced/WAL, MQTT connected and simulator running. The three genuine minor issues remain documented in open-bug-tasks.md; no new broken behavior was introduced to create exercises.
