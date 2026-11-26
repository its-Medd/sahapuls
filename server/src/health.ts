import { readFileSync } from 'node:fs';
import type { DashboardDatabase } from './db/database.js';
import type { SimulatorBridge } from './simulator.js';
export const APP_VERSION = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string;
  }
).version;
export function inspectHealth(
  db: DashboardDatabase,
  services: { mqttConnected?: () => boolean; simulator?: Pick<SimulatorBridge, 'getStatus'> },
) {
  const sqlite = db.getHealth();
  const mqttConnected = services.mqttConnected?.() ?? false;
  const simulator = services.simulator?.getStatus();
  return {
    application: 'SahaPul',
    version: APP_VERSION,
    status: sqlite.status === 'up' ? 'ok' : 'degraded',
    time: new Date().toISOString(),
    ready: sqlite.status === 'up' && mqttConnected,
    mqttConnected,
    components: {
      http: { status: 'up' },
      sqlite,
      mqtt: { status: mqttConnected ? 'connected' : 'disconnected' },
      simulator: {
        status: !simulator?.available ? 'offline' : simulator.running ? 'running' : 'paused',
        requiredForReadiness: false,
        updatedAt: simulator?.updatedAt ?? null,
      },
    },
  };
}
