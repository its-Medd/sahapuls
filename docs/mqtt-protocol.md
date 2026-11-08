# MQTT protocol

MQTT.js publishes synthetic telemetry using MQTT 3.1.1. Local development uses Aedes; Compose uses Eclipse Mosquitto. Default local endpoint: mqtt://127.0.0.1:1883. MQTT_TOPIC_PREFIX is one validated segment, default lora. Username/password configure broker access, not authenticated device ownership.

| Topic                   | Delivery            | JSON fields                                                             |
| ----------------------- | ------------------- | ----------------------------------------------------------------------- |
| lora/{nodeId}/meta      | QoS 1, retained     | nodeId, name, lat, lng, installedAt                                     |
| lora/{nodeId}/telemetry | QoS 1, non-retained | Reading below                                                           |
| lora/simulator/control  | QoS 1, non-retained | requestId, running, scenario, intervalMs                                |
| lora/simulator/status   | QoS 1, retained     | running, scenario, intervalMs, updatedAt, optional confirming requestId |

## Example telemetry

This is a protocol example, not historical data:

```json
{
  "nodeId": "node-01",
  "seq": 1,
  "ts": "2026-11-08T12:00:00.000Z",
  "temperatureC": 22.5,
  "humidityPct": 51,
  "gasPpm": 10,
  "batteryPct": 92,
  "soilMoisturePct": 55,
  "waterLevelCm": 65,
  "lat": 49.9812,
  "lng": -119.4012,
  "simulatedAlert": false
}
```

## Validation and persistence

For both message types, topic and JSON nodeId must match before any write. IDs contain 1–64 ASCII letters, digits, underscores or hyphens. Payloads are at most 16384 bytes; sequences are safe nonnegative integers. Values must be finite: temperature −100–150°C, percentages 0–100, gas 0–1000000 ppm, water 0–100000 cm, latitude −90–90, longitude −180–180. Valid UTC/offset timestamps normalize to UTC; MQTT rejects telemetry more than five minutes in the future.

Soil/water can be absent/null for legacy publishers. Missing sensors remain null and cannot imply recovery. A user display-name override survives retained metadata updates. Exact (nodeId, ts, seq) retransmissions are persistently idempotent. Device/alert/history/reading writes share a transaction and events follow commit. Late readings enter history without regressing current alert or station state. Communication health uses server receive time.

## Lifecycle and controls

Handlers are attached before subscription; explicit reconnect subscription with resubscribe disabled prevents accumulated application listeners. HTTP starts without a broker. Connection, offline, reconnect and subscription failures are logged. Simulator metadata is republished after reconnect, with paused state preserved within the process.

Controls succeed only after matching requestId confirmation. Heartbeats arrive every ten seconds and expire after 30 seconds. Unavailable control returns HTTP 503; missing confirmation returns 504. Retained control packets are rejected. Pause uses the confirmed interval/scenario, so invalid draft text cannot block stopping telemetry. Timers and clients are closed on shutdown; the root runner uses IPC for orderly Windows shutdown before bounded termination fallback.

Anonymous local MQTT is not production authentication. Application byte limits apply after receipt; broker packet/connection quotas, device ACLs and TLS remain deployment requirements before exposure beyond loopback.
