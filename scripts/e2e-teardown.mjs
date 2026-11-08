import { existsSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
export default function teardown() {
  const file = process.env.SAHAPUL_E2E_PIDS;
  if (!file || !existsSync(file)) return;
  const pids = readFileSync(file, 'utf8')
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((pid) => Number.isSafeInteger(pid) && pid > 0);
  // Stop only the service PIDs registered by this isolated test invocation.
  if (process.platform === 'win32' && pids.length)
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        `Stop-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue`,
      ],
      { stdio: 'ignore', windowsHide: true },
    );
  else
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
      } catch {
        /* Already stopped. */
      }
    }
  rmSync(file, { force: true });
}
