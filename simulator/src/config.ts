import 'dotenv/config';
import { SCENARIOS, type Scenario } from './scenarios.js';
export interface SimulatorConfig {
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  topicPrefix: string;
  nodeCount: number;
  publishIntervalMs: number;
  alertMode: 'random' | 'off';
  alertProbability: number;
  alertCheckIntervalMs: number;
  scenario: Scenario;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): SimulatorConfig {
  function number(
    name: string,
    fallback: number,
    min: number,
    max: number,
    integer = true,
  ): number {
    const value = Number(env[name] ?? fallback);
    if (
      !Number.isFinite(value) ||
      (integer && !Number.isInteger(value)) ||
      value < min ||
      value > max
    )
      throw new Error(`${name} must be ${min}–${max}`);
    return value;
  }
  const scenario = env.SCENARIO ?? 'random';
  if (!SCENARIOS.includes(scenario as Scenario)) throw new Error('Unknown SCENARIO');
  const prefix = env.MQTT_TOPIC_PREFIX ?? 'lora';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(prefix))
    throw new Error('MQTT_TOPIC_PREFIX must be one segment');
  const mqttUrl = env.MQTT_URL ?? 'mqtt://localhost:1883';
  if (!['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(new URL(mqttUrl).protocol))
    throw new Error('Invalid MQTT_URL');
  if (env.ALERT_MODE && !['random', 'off'].includes(env.ALERT_MODE))
    throw new Error('ALERT_MODE must be random or off');
  return {
    mqttUrl,
    mqttUsername: env.MQTT_USERNAME || undefined,
    mqttPassword: env.MQTT_PASSWORD || undefined,
    topicPrefix: prefix,
    nodeCount: number('NODE_COUNT', 6, 1, 1000),
    publishIntervalMs: number('PUBLISH_INTERVAL_MS', 4000, 250, 60000),
    alertMode: env.ALERT_MODE === 'off' ? 'off' : 'random',
    alertProbability: number('ALERT_PROBABILITY', 0.35, 0, 1, false),
    alertCheckIntervalMs: number('ALERT_CHECK_INTERVAL_MS', 45000, 1000, 3600000),
    scenario: scenario as Scenario,
  };
}
