import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { DashboardDatabase } from './db/database.js';
import { startMqttSubscriber } from './mqtt/subscriber.js';
import { createSocketServer } from './realtime/socket.js';

function log(message: string): void {
  console.log(`[server] ${new Date().toISOString()} ${message}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const db = new DashboardDatabase(config.dbPath);

  const app = createApp(db, config.corsOrigin);
  const httpServer = createServer(app);
  const { emitter } = createSocketServer(httpServer, db, config.corsOrigin);

  log(`connecting to MQTT broker at ${config.mqttUrl} ...`);
  const mqttClient = await startMqttSubscriber(db, emitter, {
    mqttUrl: config.mqttUrl,
    mqttUsername: config.mqttUsername,
    mqttPassword: config.mqttPassword,
    topicPrefix: config.topicPrefix,
  });

  httpServer.listen(config.port, () => {
    log(`REST + WebSocket API listening on http://localhost:${config.port}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    log(`received ${signal}, shutting down...`);
    await mqttClient.endAsync();
    httpServer.close();
    db.close();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[server] fatal error:', err);
  process.exit(1);
});
