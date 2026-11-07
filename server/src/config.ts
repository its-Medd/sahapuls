import 'dotenv/config';

export interface ServerConfig {
  port: number;
  mqttUrl: string;
  mqttUsername?: string;
  mqttPassword?: string;
  topicPrefix: string;
  dbPath: string;
  corsOrigin: string;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: envInt('PORT', 4000),
    mqttUrl: env.MQTT_URL ?? 'mqtt://localhost:1883',
    mqttUsername: env.MQTT_USERNAME,
    mqttPassword: env.MQTT_PASSWORD,
    topicPrefix: env.MQTT_TOPIC_PREFIX ?? 'lora',
    dbPath: env.DB_PATH ?? './data/dashboard.sqlite',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
