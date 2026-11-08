import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { once } from 'node:events';
test(
  'one-command runner starts, reports readiness, reuses services and shuts down only its own processes',
  { timeout: 120000 },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sahapul-dev-smoke-'));
    const env = {
      ...process.env,
      PORT: '4028',
      WEB_PORT: '5188',
      MQTT_PORT: '18888',
      DB_PATH: join(dir, 'test.sqlite'),
      SCENARIO: 'normal',
      ALERT_MODE: 'off',
      PUBLISH_INTERVAL_MS: '250',
    };
    delete env.MQTT_URL;
    delete env.CORS_ORIGIN;
    delete env.VITE_API_URL;
    const runner = spawn(process.execPath, ['scripts/dev.mjs'], {
      env,
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      windowsHide: true,
    });
    let log = '';
    runner.stdout.on('data', (data) => {
      log += data;
    });
    runner.stderr.on('data', (data) => {
      log += data;
    });
    async function waitFor(check) {
      const end = Date.now() + 60000;
      while (Date.now() < end) {
        try {
          if (await check()) return;
        } catch {
          /* Starting up. */
        }
        if (runner.exitCode !== null) throw new Error(log);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`Startup timeout: ${log}`);
    }
    try {
      await waitFor(() => log.includes('SahaPul ready'));
      const health = await (await fetch('http://127.0.0.1:4028/api/health/ready')).json();
      assert.equal(health.ready, true);
      assert.equal((await fetch('http://127.0.0.1:5188')).status, 200);
      const summary = await (await fetch('http://127.0.0.1:4028/api/summary')).json();
      assert.ok(summary.readingCount > 0);
      const reuse = spawn(process.execPath, ['scripts/dev.mjs'], {
        env,
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        windowsHide: true,
      });
      let reuseLog = '';
      reuse.stdout.on('data', (data) => {
        reuseLog += data;
      });
      reuse.stderr.on('data', (data) => {
        reuseLog += data;
      });
      const end = Date.now() + 30000;
      while (!reuseLog.includes('SahaPul ready') && Date.now() < end)
        await new Promise((resolve) => setTimeout(resolve, 100));
      assert.match(reuseLog, /Reusing SahaPul backend/);
      assert.match(reuseLog, /Reusing the connected simulator/);
      assert.match(reuseLog, /SahaPul ready/);
      const reusedExit = once(reuse, 'exit');
      if (reuse.connected) reuse.send('shutdown');
      else throw new Error(reuseLog);
      await reusedExit;
      assert.equal((await fetch('http://127.0.0.1:4028/api/health/live')).status, 200);
      const exit = once(runner, 'exit');
      runner.send('shutdown');
      await exit;
      assert.equal(runner.exitCode, 0);
      assert.match(log, /shutdown complete; database closed/);
      await assert.rejects(fetch('http://127.0.0.1:4028/api/health/live'));
    } finally {
      if (runner.exitCode === null) {
        const exit = once(runner, 'exit');
        if (runner.connected) runner.send('shutdown', () => {});
        else runner.kill();
        await exit;
      }
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
