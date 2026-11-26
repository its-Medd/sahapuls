import { spawn } from 'node:child_process';
import { createConnection } from 'node:net';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const children = [];
let stopping = false;
function port(name, fallback) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65535)
    throw new Error(`${name} must be a valid TCP port`);
  return value;
}
function listening(portNumber) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port: portNumber });
    socket.setTimeout(500);
    const finish = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}
function start(name, args, cwd, env) {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    windowsHide: true,
  });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[dev] ${name}: ${error.message}`);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) {
      console.error(`[dev] ${name} exited (${code}); stopping managed services`);
      stop(code || 1);
    }
  });
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    try {
      if (child.connected)
        child.send('shutdown', (error) => {
          if (error && child.exitCode === null) child.kill('SIGTERM');
        });
      else child.kill('SIGTERM');
    } catch {
      /* Already stopped. */
    }
  }
  setTimeout(() => {
    for (const child of children) {
      try {
        child.kill('SIGKILL');
      } catch {
        /* Already stopped. */
      }
    }
    process.exit(code);
  }, 3000).unref();
  console.log('[dev] Managed processes stopped; reused services were left running.');
  process.stdin.pause();
  process.exitCode = code;
}
async function waitFor(check, label) {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    if (stopping) throw new Error('Startup interrupted');
    try {
      if (await check()) return;
    } catch {
      /* Service is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`${label} did not become available within 45 seconds`);
}
async function json(url) {
  return await (await fetch(url, { signal: AbortSignal.timeout(5000) })).json();
}
async function main() {
  const brokerPort = port('MQTT_PORT', 1883),
    apiPort = port('PORT', 4000),
    webPort = port('WEB_PORT', 5173);
  const mqttUrl = process.env.MQTT_URL ?? `mqtt://127.0.0.1:${brokerPort}`;
  const api = `http://127.0.0.1:${apiPort}`,
    web = `http://127.0.0.1:${webPort}`;
  if (!process.env.MQTT_URL) {
    if (await listening(brokerPort)) console.log(`[dev] Reusing broker on ${brokerPort}`);
    else {
      start('broker', ['scripts/broker.mjs'], root, { MQTT_PORT: String(brokerPort) });
      await waitFor(() => listening(brokerPort), 'MQTT broker');
    }
  }
  if (await listening(apiPort)) {
    const health = await json(`${api}/api/health`);
    if (health.application !== 'SahaPul')
      throw new Error(`Port ${apiPort} belongs to another service; set PORT or stop it yourself.`);
    console.log(`[dev] Reusing SahaPul backend on ${apiPort}`);
  } else {
    start('backend', ['--import', 'tsx', 'src/index.ts'], join(root, 'server'), {
      HOST: '127.0.0.1',
      PORT: String(apiPort),
      MQTT_URL: mqttUrl,
      CORS_ORIGIN: process.env.CORS_ORIGIN ?? web,
    });
    await waitFor(
      async () => (await json(`${api}/api/health/live`)).status === 'alive',
      'HTTP backend',
    );
  }
  if ((await json(`${api}/api/simulator`)).available)
    console.log('[dev] Reusing the connected simulator');
  else {
    start('simulator', ['--import', 'tsx', 'src/index.ts'], join(root, 'simulator'), {
      MQTT_URL: mqttUrl,
    });
    await waitFor(async () => (await json(`${api}/api/simulator`)).available, 'simulator');
  }
  if (await listening(webPort)) {
    const response = await fetch(web, { signal: AbortSignal.timeout(5000) });
    if (!(await response.text()).includes('SahaPul'))
      throw new Error(
        `Port ${webPort} belongs to another service; set WEB_PORT or stop it yourself.`,
      );
    console.log(`[dev] Reusing dashboard on ${webPort}`);
  } else {
    const require = createRequire(join(root, 'web', 'package.json'));
    const vite = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');
    start(
      'dashboard',
      [vite, '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'],
      join(root, 'web'),
      { VITE_API_URL: api },
    );
    await waitFor(
      async () => (await fetch(web, { signal: AbortSignal.timeout(5000) })).ok,
      'dashboard',
    );
  }
  console.log(
    `[dev] SahaPul ready: ${web}\n[dev] API: ${api} — Ctrl+C stops only processes started by this runner.`,
  );
  process.stdin.resume();
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
// Used by the isolated startup smoke test; ordinary terminals stop with Ctrl+C.
process.on('message', (message) => {
  if (message === 'shutdown') stop();
});
main().catch((error) => {
  console.error(`[dev] ${error.message}`);
  stop(1);
});
