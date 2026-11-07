import mqtt from 'mqtt';
import { loadConfig } from './config.js';
import { createFleet } from './fleet.js';
import { pickRandom } from './random.js';
import type { VirtualNode } from './node.js';

function log(message: string): void {
  console.log(`[simulator] ${new Date().toISOString()} ${message}`);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const fleet = createFleet(config.nodeCount);

  log(`connecting to ${config.mqttUrl} ...`);
  const client = await mqtt.connectAsync(config.mqttUrl, {
    username: config.mqttUsername,
    password: config.mqttPassword,
    clientId: `lora-simulator-${Math.random().toString(16).slice(2, 8)}`,
    reconnectPeriod: 2000,
  });
  log('connected.');

  client.on('reconnect', () => log('reconnecting to broker...'));
  client.on('error', (err) => log(`mqtt error: ${err.message}`));

  // Publish retained metadata for each node once at startup so the backend
  // (or any MQTT client) can discover the fleet without a separate REST call.
  await Promise.all(
    fleet.map((node) =>
      client.publishAsync(
        `${config.topicPrefix}/${node.nodeId}/meta`,
        JSON.stringify(node.toMeta()),
        {
          qos: 1,
          retain: true,
        },
      ),
    ),
  );
  log(`published metadata for ${fleet.length} node(s).`);

  const publishTick = async (): Promise<void> => {
    await Promise.all(
      fleet.map(async (node) => {
        const reading = node.tick();
        try {
          await client.publishAsync(
            `${config.topicPrefix}/${node.nodeId}/telemetry`,
            JSON.stringify(reading),
            {
              qos: 0,
            },
          );
        } catch (err) {
          log(`failed to publish for ${node.nodeId}: ${(err as Error).message}`);
        }
      }),
    );
  };

  const publishTimer = setInterval(() => {
    void publishTick();
  }, config.publishIntervalMs);

  let alertTimer: NodeJS.Timeout | undefined;
  if (config.alertMode === 'random') {
    alertTimer = setInterval(() => {
      maybeTriggerRandomAlert(fleet, config.alertProbability);
    }, config.alertCheckIntervalMs);
    log(
      `random alert simulation enabled (p=${config.alertProbability} every ${config.alertCheckIntervalMs}ms).`,
    );
  } else {
    log('random alert simulation disabled (ALERT_MODE=off).');
  }

  await publishTick();

  const shutdown = async (signal: string): Promise<void> => {
    log(`received ${signal}, shutting down...`);
    clearInterval(publishTimer);
    if (alertTimer) clearInterval(alertTimer);
    await client.endAsync();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

function maybeTriggerRandomAlert(fleet: VirtualNode[], probability: number): void {
  const idleNodes = fleet.filter((node) => !node.isInAlertEpisode);
  if (idleNodes.length === 0) return;
  if (Math.random() > probability) return;

  const target = pickRandom(idleNodes);
  target.triggerAlertEpisode();
  log(`triggering simulated alert episode on ${target.nodeId} (${target.name})`);
}

main().catch((err) => {
  console.error('[simulator] fatal error:', err);
  process.exit(1);
});
