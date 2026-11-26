# SahaPul interaction contract

Business evidence: the current task brief, MQTT payload schema (`server/src/mqtt/parse.ts`), alert transitions (`server/src/alerts/lifecycle.ts`), and HTTP routes define the implemented contract. This is a local single-user simulation demo. No authentication, deletion, billing, external messaging or legal-consent workflow is implemented.

| Capability     | Canonical owner                     | Source of truth                      | Allowed variants                                     | Verification                         |
| -------------- | ----------------------------------- | ------------------------------------ | ---------------------------------------------------- | ------------------------------------ |
| Select/Listbox | Native HTML select                  | DESIGN.md                            | Platform-owned popup                                 | Browser keyboard and narrow viewport |
| Form           | Label/input and global field styles | App device editor; SimulatorControls | Inline validated device naming and simulator control | API tests and browser flows          |
| Scrollbar      | web/src/index.css                   | DESIGN.md                            | Document/table/nav overflow                          | Browser computed styles              |
| Toast          | Inline role=status / role=alert     | AsyncState and owning operation      | Success/error within action scope                    | Component and browser checks         |
| CRUD           | requestJson and backend routes      | server/src/routes/nodes.ts           | Read/update only; no delete UI                       | API and E2E                          |

Navigation uses hash links with `aria-current`; headings/document titles reflect the current view. Device selection is shared across overview, analytics and device details. Name drafts stay in App state across views, and unsaved names trigger the standard browser unload warning. No custom calendar or table-selection capability exists.

Reads expose loading, error with retry, success and empty results. Socket listeners are removed on cleanup; reconnect refetches REST snapshots. Live rows merge by primary key so delayed snapshots cannot overwrite new events. History is explicitly bounded to the latest 5000 records in a fixed selected window; Refresh advances that window.

Mutations disable their submit control while pending, preserve failed input, and announce success/error inline. Device names persist on the backend and override retained metadata names. Alerts move OPEN → ACKNOWLEDGED → RESOLVED; acknowledgment is idempotent and recovery is automatic using server hysteresis. Escalation reopens review. Simulator controls report success only after the publishing process confirms its request ID over MQTT; a timeout asks the user to refresh before retrying.

Settings policy is read-only. Compact density is a reversible browser preference. Native dropdown behavior, browser number keyboards, local date formatting and browser unload warning are accepted platform-owned interactions. Global styling follows DESIGN.md. Keyboard focus stays visible; no clickable non-semantic containers. The station list is the keyboard alternative to map selection.

## Submission extensions

DeviceInventory/filterDevices own local search and health/condition filtering. Clear restores input focus; reset removes all filters; q/health/condition persist in the URL. No remote search requests or artificial delays occur.

Analytics uses the complete bounded source window, never an unweighted mean of bucket means. The device, range and metric control the query/chart; Refresh advances the window. Null sensors remain unmeasured, and each statistic includes its actual sample count. More than 50000 samples produces an explicit narrowing request.

SystemStatus distinguishes HTTP, SQLite, MQTT, simulator and application version. Readiness requires SQLite and MQTT; a simulator may be paused/offline while stored history remains available. Pause uses confirmed simulator settings, so an invalid unsaved interval cannot block stopping publication.
