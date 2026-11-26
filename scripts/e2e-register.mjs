import { appendFileSync } from 'node:fs';
if (process.env.SAHAPUL_E2E_PIDS) appendFileSync(process.env.SAHAPUL_E2E_PIDS, `${process.pid}\n`);
