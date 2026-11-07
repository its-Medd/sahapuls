export interface SimulatorConfig {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  topicPrefix: string;
  nodeCount: number;
  publishIntervalMs: number;
  alertMode: 'random' | 'off';
  /** Probability (0-1) that a new random alert episode starts on each alert-check tick. */
  alertProbability: number;
  /** How often (ms) we roll the dice for a new random alert episode. */
  alertCheckIntervalMs: number;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): SimulatorConfig {
  const alertModeRaw = (env.ALERT_MODE ?? 'random').toLowerCase();
  const alertMode: SimulatorConfig['alertMode'] = alertModeRaw === 'off' ? 'off' : 'random';

  return {
    mqttUrl: env.MQTT_URL ?? 'mqtt://localhost:1883',
    mqttUsername: env.MQTT_USERNAME,
    mqttPassword: env.MQTT_PASSWORD,
    topicPrefix: env.MQTT_TOPIC_PREFIX ?? 'lora',
    nodeCount: envInt('NODE_COUNT', 6),
    publishIntervalMs: envInt('PUBLISH_INTERVAL_MS', 4000),
    alertMode,
    alertProbability: envFloat('ALERT_PROBABILITY', 0.35),
    alertCheckIntervalMs: envInt('ALERT_CHECK_INTERVAL_MS', 45_000),
  };
}
