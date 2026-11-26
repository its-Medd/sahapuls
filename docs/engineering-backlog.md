# Engineering backlog

## Deployment work (not local-demo completion claims)

1. Design authentication and authorization across HTTP, Socket.IO and MQTT ownership; add broker ACLs and TLS before non-loopback deployment.
2. Add rate limits, broker packet/connection quotas, structured rejection counters and operational monitoring.
3. Choose telemetry retention and rollup requirements with the data owner; add online backup/restore and verify recovery.
4. Monitor the scoped minimatch 11 security override and remove it when upstream typescript-eslint adopts the patched major. The current scan is clean. Review deprecated Recharts 2 migration separately from functional fixes.
5. Build/start Compose on a running Docker engine, then rerun the lifecycle against Mosquitto and verify SQLite volume permissions. Current config validation passes; container startup was blocked by a missing Docker engine.
6. Integrate a real LoRaWAN gateway, device provisioning and signed identity only if physical hardware becomes part of the product scope.

## Maintainability and scale

- Compute aggregation in SQL or a time-series store for ranges beyond the explicit 50000-sample safety bound.
- Add cursor pagination for full alert history instead of the newest 100 episodes in UI. Expose per-metric measurement counts in nullable aggregation.
- Reconcile preexisting duplicate legacy alert rows via an explicit operator-reviewed migration; do not invent their historical lifecycle.
- Consider a shared versioned protocol package or generated wire types to reduce drift across three independently deployable workspaces.
- Add metric trend comparisons and richer device configuration only after matching backend operations exist.
- Add visual regression baselines and Firefox/Safari coverage. Current browser validation uses Edge on Windows.
- Keep map tiles/provider configurable; provide a true offline basemap if required.
- Extend a11y coverage to third-party Leaflet interactions and chart screen-reader descriptions; automated checks now cover all seven main views while excluding the Leaflet surface, with a keyboard station-list alternative.
- Add concurrent rename conflict detection before supporting multiple operators; current application is a local single-user demo.
- Add long-duration and multi-restart soak tests. A single actual broker restart, browser offline/reconnect path and broker-unavailable HTTP startup are now verified.

See open-bug-tasks.md for three deliberately retained minor formatting/readability exercises.
