import { createServer } from 'node:http';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { DashboardDatabase } from './db/database.js';
import { startMqttSubscriber } from './mqtt/subscriber.js';
import { createSocketServer } from './realtime/socket.js';
import { SimulatorBridge } from './simulator.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = new DashboardDatabase(config.dbPath);
  console.log(`[server] SQLite ready; schema ${db.getHealth().schemaVersion}`);
  const services: Parameters<typeof createApp>[2] = {};
  const httpServer = createServer(createApp(db, config.corsOrigin, services));
  const { io, emitter } = createSocketServer(httpServer, db, config.corsOrigin);
  const client = await startMqttSubscriber(db, emitter, config);
  const simulator = new SimulatorBridge(client, config.topicPrefix);
  Object.assign(services, { emitter, simulator, mqttConnected: () => client.connected });
  const healthTimer = setInterval(() => {
    for (const node of db.getNodes()) emitter.emitNode?.(node);
  }, 5000);
  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('[server] stopping HTTP, MQTT and realtime connections');
    clearInterval(healthTimer);
    simulator.close();
    const deadline = setTimeout(() => process.exit(1), 5000);
    deadline.unref();
    await client.endAsync(true);
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    db.close();
    console.log('[server] shutdown complete; database closed');
    clearTimeout(deadline);
  };
  process.once('SIGINT', () => {
    void shutdown().catch(console.error);
  });
  process.once('SIGTERM', () => {
    void shutdown().catch(console.error);
  });
  process.on('message', (message) => {
    if (message === 'shutdown')
      void shutdown()
        .then(() => {
          process.disconnect?.();
        })
        .catch(console.error);
  });
  httpServer.once('error', (error) => {
    console.error('[server]', error.message);
    void shutdown().then(() => {
      process.exitCode = 1;
    });
  });
  httpServer.listen(config.port, config.host, () =>
    console.log(`[server] SahaPul listening on http://${config.host}:${config.port}`),
  );
}
main().catch((error: unknown) => {
  console.error('[server] startup failed', error);
  process.exitCode = 1;
});
