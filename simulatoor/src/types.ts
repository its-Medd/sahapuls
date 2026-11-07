/**
 * Shared shape of a single telemetry reading published by a virtual sensor node.
 * This mirrors what a real LoRa sensor node (e.g. an ESP32 + RFM95 board running
 * a temperature/humidity/gas sensor stack) would send up through a LoRaWAN
 * gateway and application server, simplified to a flat JSON payload for the
 * MQTT bridge in this demo.
 */
export interface TelemetryReading {
  nodeId: string;
  seq: number;
  ts: string; // ISO-8601 timestamp
  temperatureC: number;
  humidityPct: number;
  gasPpm: number;
  batteryPct: number;
  lat: number;
  lng: number;
  /** True while this reading is part of a simulated alert episode (for debugging/demo only). */
  simulatedAlert: boolean;
}

/** Static metadata about a node, published retained once at startup. */
export interface NodeMeta {
  nodeId: string;
  name: string;
  lat: number;
  lng: number;
  installedAt: string;
}
