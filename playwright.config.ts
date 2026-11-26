import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
process.env.SAHAPUL_E2E_DB ??= join(tmpdir(), `sahapul-e2e-${process.pid}.sqlite`);
process.env.SAHAPUL_E2E_PIDS ??= join(tmpdir(), `sahapul-e2e-${process.pid}.pids`);
const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  globalTeardown: './scripts/e2e-teardown.mjs',
  expect: { timeout: 12000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5178',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    launchOptions: existsSync(edge) ? { executablePath: edge } : {},
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'node --import ./scripts/e2e-register.mjs scripts/broker.mjs',
      port: 18883,
      env: { MQTT_PORT: '18883' },
      reuseExistingServer: false,
    },
    {
      command: 'node --import ./scripts/e2e-register.mjs server/dist/index.js',
      url: 'http://127.0.0.1:4018/api/health',
      env: {
        PORT: '4018',
        HOST: '127.0.0.1',
        DB_PATH: process.env.SAHAPUL_E2E_DB,
        MQTT_URL: 'mqtt://127.0.0.1:18883',
        CORS_ORIGIN: 'http://127.0.0.1:5178',
      },
      reuseExistingServer: false,
    },
    {
      command: 'node --import ./scripts/e2e-register.mjs simulator/dist/index.js',
      env: {
        MQTT_URL: 'mqtt://127.0.0.1:18883',
        NODE_COUNT: '3',
        PUBLISH_INTERVAL_MS: '250',
        SCENARIO: 'normal',
        ALERT_MODE: 'off',
      },
      wait: { stdout: /SimulatorReady/ },
      reuseExistingServer: false,
    },
    {
      command:
        'node --import ../scripts/e2e-register.mjs node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort',
      cwd: join(process.cwd(), 'web'),
      url: 'http://127.0.0.1:5178',
      env: { VITE_API_URL: 'http://127.0.0.1:4018' },
      reuseExistingServer: false,
    },
  ],
});
