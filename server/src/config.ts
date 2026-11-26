import 'dotenv/config';
export interface ServerConfig {
  port: number;
  host: string;
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  topicPrefix: string;
  dbPath: string;
  corsOrigin: string;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env.PORT ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer from 1 to 65535');
  const topicPrefix = env.MQTT_TOPIC_PREFIX ?? 'lora';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(topicPrefix))
    throw new Error('MQTT_TOPIC_PREFIX must be one topic segment');
  const mqttUrl = env.MQTT_URL ?? 'mqtt://localhost:1883';
  if (!['mqtt:', 'mqtts:', 'ws:', 'wss:'].includes(new URL(mqttUrl).protocol))
    throw new Error('Invalid MQTT_URL protocol');
  return {
    port,
    host: env.HOST ?? '127.0.0.1',
    mqttUrl,
    mqttUsername: env.MQTT_USERNAME || undefined,
    mqttPassword: env.MQTT_PASSWORD || undefined,
    topicPrefix,
    dbPath: env.DB_PATH ?? './data/dashboard.sqlite',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
