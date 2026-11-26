import mqtt from 'mqtt';
import { loadConfig } from './config.js';
import { createFleet } from './fleet.js';
import { pickRandom } from './random.js';
import { SimulationRuntime } from './runtime.js';
import { SCENARIOS, type Scenario } from './scenarios.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const fleet = createFleet(config.nodeCount);
  const client = mqtt.connect(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    reconnectPeriod: 2000,
    connectTimeout: 5000,
    resubscribe: false,
    queueQoSZero: false,
    will: {
      topic: `${config.topicPrefix}/simulator/status`,
      payload: JSON.stringify({
        running: false,
        scenario: config.scenario,
        intervalMs: config.publishIntervalMs,
        updatedAt: '1970-01-01T00:00:00.000Z',
      }),
      qos: 1,
      retain: true,
    },
  });
  const runtime = new SimulationRuntime(
    fleet,
    async (reading) => {
      if (!client.connected) return;
      await client.publishAsync(
        `${config.topicPrefix}/${reading.nodeId}/telemetry`,
        JSON.stringify(reading),
        { qos: 1 },
      );
    },
    config.publishIntervalMs,
    config.scenario,
  );
  const status = async (requestId?: string): Promise<void> => {
    if (client.connected)
      await client.publishAsync(
        `${config.topicPrefix}/simulator/status`,
        JSON.stringify({ ...runtime.state, updatedAt: new Date().toISOString(), requestId }),
        { qos: 1, retain: true },
      );
  };
  client.on('error', (error) => console.error('[simulator]', error.message));
  let initialized = false;
  client.on('connect', () => {
    void (async () => {
      await Promise.all(
        fleet.map((node) =>
          client.publishAsync(
            `${config.topicPrefix}/${node.nodeId}/meta`,
            JSON.stringify(node.toMeta()),
            { qos: 1, retain: true },
          ),
        ),
      );
      await client.subscribeAsync(`${config.topicPrefix}/simulator/control`, { qos: 1 });
      if (!initialized) {
        initialized = true;
        runtime.start();
      }
      await status();
      console.log('[simulator] SimulatorReady');
    })().catch((error: unknown) => console.error('[simulator] connection setup failed', error));
  });
  client.on('message', (topic, payload, packet) => {
    if (
      topic !== `${config.topicPrefix}/simulator/control` ||
      packet.retain ||
      payload.length > 16384
    )
      return;
    try {
      const input: unknown = JSON.parse(payload.toString());
      if (!input || typeof input !== 'object') return;
      const command = input as Record<string, unknown>;
      if (
        typeof command.running !== 'boolean' ||
        !SCENARIOS.includes(command.scenario as Scenario) ||
        !Number.isInteger(command.intervalMs) ||
        Number(command.intervalMs) < 250 ||
        Number(command.intervalMs) > 60000 ||
        typeof command.requestId !== 'string' ||
        command.requestId.length > 100
      )
        return;
      runtime.configure(command.running, command.scenario as Scenario, Number(command.intervalMs));
      void status(command.requestId).catch(console.error);
    } catch {
      /* Invalid controls cannot change runtime state. */
    }
  });
  const heartbeat = setInterval(() => {
    void status().catch(console.error);
  }, 10000);
  const alerts = setInterval(() => {
    if (
      !runtime.state.running ||
      runtime.state.scenario !== 'random' ||
      config.alertMode === 'off' ||
      Math.random() >= config.alertProbability
    )
      return;
    const idle = fleet.filter((node) => !node.isInAlertEpisode);
    if (idle.length) pickRandom(idle).triggerAlertEpisode();
  }, config.alertCheckIntervalMs);
  let closing = false;
  const shutdown = async (): Promise<void> => {
    if (closing) return;
    closing = true;
    clearInterval(heartbeat);
    clearInterval(alerts);
    runtime.stop();
    const deadline = setTimeout(() => process.exit(1), 5000);
    deadline.unref();
    await client.endAsync(true);
    await runtime.close();
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
}
main().catch((error: unknown) => {
  console.error('[simulator] startup failed', error);
  process.exitCode = 1;
});
